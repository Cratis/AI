// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;
using Cratis.AI.Usage;
using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Workers;

/// <summary>
/// An <see cref="IWorkerRuntime"/> that launches worker containers directly on the Docker engine -
/// the runtime used when running and testing locally. Ported from Direct's
/// <c>Work.Workers.DockerWorkerRuntime</c> (plan Section 5.6), <c>WorkId</c> generalized to
/// <see cref="AgentSessionId"/> and <c>ContainerRuntimeOptions</c> to <see cref="WorkerRuntimeOptions"/>.
/// </summary>
/// <param name="options">The <see cref="WorkerRuntimeOptions"/> configuring the Docker endpoint.</param>
/// <param name="logger">The logger.</param>
public class DockerWorkerRuntime(IOptions<WorkerRuntimeOptions> options, ILogger<DockerWorkerRuntime> logger) : IWorkerRuntime
{
    /// <summary>
    /// How long the Docker engine waits between the SIGTERM it sends a stopped worker container and
    /// the SIGKILL that follows it.
    /// </summary>
    /// <remarks>
    /// The same window <see cref="KubernetesWorkerRuntime"/> gives a pod through
    /// <c>terminationGracePeriodSeconds</c>, and for the same reason: <c>entrypoint.sh</c> pushes
    /// whatever the agent committed from its SIGTERM trap, and a container removed by force never
    /// gets to run it, so its commits die with it. Shorter than the Kubernetes window because this
    /// one is waited out inline - deleting a Job returns immediately and the kubelet times the grace
    /// itself, whereas the Docker engine holds the stop request open until the container exits, and
    /// a caller stopping a worker by hand is waiting on that call. Only a container that ignores
    /// SIGTERM waits the whole window; the entrypoint exits as soon as it has pushed, and the engine
    /// stops waiting there and then.
    /// </remarks>
    const uint StopGraceSeconds = 30;

    /// <summary>
    /// Builds the container specification for a worker - what <c>docker inspect</c> reads back, and
    /// therefore what must carry no credential.
    /// </summary>
    /// <param name="job">The worker job to describe.</param>
    /// <param name="repositoryCachePath">
    /// The path to bind-mount the shared repository cache at, from
    /// <see cref="WorkerRuntimeOptions.RepositoryCachePath"/> - <see langword="null"/> or empty (the
    /// default) omits the mount and the repository-cache environment variable entirely.
    /// </param>
    /// <param name="repositoryCacheEnvironmentVariable">
    /// The environment variable name a consumer's own <c>entrypoint.sh</c> reads the mounted cache
    /// path from, from <see cref="WorkerRuntimeOptions.RepositoryCacheEnvironmentVariable"/> -
    /// configurable rather than fixed, since it names a consumer-owned contract (Direct's own
    /// <c>entrypoint.sh</c> still reads <c>DIRECT_REPOSITORY_CACHE</c> literally).
    /// </param>
    /// <returns>The container creation parameters.</returns>
    public static CreateContainerParameters BuildContainerSpecification(
        WorkerJob job,
        string? repositoryCachePath = null,
        string? repositoryCacheEnvironmentVariable = null) =>
        new()
        {
            Image = job.Image,

            // Only non-secret configuration goes on the container specification, because
            // `docker inspect` reads it back and it outlives the container. Credentials are
            // copied into the tmpfs below instead; what is named here is a path, not a secret.
            Name = NameFor(job.Session),

            // The prompt is left off for a harder reason than the credentials are: a single
            // environment variable over MAX_ARG_STRLEN makes the kernel refuse the whole execve, so
            // a large enough prompt stops the container starting at all. It is copied in as a file
            // below - see WorkerPromptFile - and what goes here is the path to it.
            Env =
            [
                .. job.EnvironmentVariables
                    .Where(variable => variable.Key != WorkerPromptFile.LegacyVariableName)
                    .Select(variable => $"{variable.Key}={variable.Value}"),
                $"{WorkerSecrets.PathVariableName}={WorkerSecrets.Path}",
                $"{WorkerPromptFile.PathVariableName}={WorkerPromptFile.Path}",
                .. string.IsNullOrWhiteSpace(repositoryCachePath) || string.IsNullOrWhiteSpace(repositoryCacheEnvironmentVariable)
                    ? (string[])[]
                    : [$"{repositoryCacheEnvironmentVariable}={repositoryCachePath}"]
            ],

            // A TTY keeps the log a single raw stream, which also gives a live console a clean
            // line-by-line feed. Stdin stays open so steering text can be sent to the running session.
            Tty = true,
            OpenStdin = true,
            StdinOnce = false,
            HostConfig = new HostConfig
            {
                // Lets the container reach the consumer's callback endpoint on the host from Linux
                // engines; Docker Desktop provides the alias out of the box.
                ExtraHosts = ["host.docker.internal:host-gateway"],

                // The secrets land on a memory-backed mount, so they never touch the container's
                // writable layer and cannot be recovered from a committed image or a stopped
                // container's filesystem.
                Tmpfs = new Dictionary<string, string> { [WorkerSecrets.Directory] = "rw,noexec,nosuid,mode=0700" },

                // Shares the host's mirror of every tracked repository with the container, so
                // clone_into_workspace() in entrypoint.sh can `git clone --shared` against it
                // instead of cloning fresh from GitHub every run. Host path equals container path,
                // the same convention the Kubernetes PVC mount uses.
                Binds = string.IsNullOrWhiteSpace(repositoryCachePath)
                    ? []
                    : [$"{repositoryCachePath}:{repositoryCachePath}"]
            }
        };

    /// <inheritdoc/>
    /// <remarks>
    /// Always <see cref="WorkerLaunchOutcome.Started"/> on return - a local Docker daemon has no
    /// equivalent of the anticipated "previous worker still around" cases <see cref="KubernetesWorkerRuntime"/>
    /// has to account for. A genuine failure here (the daemon itself unreachable) is unrecoverable
    /// from this runtime's own perspective and propagates as an exception rather than a
    /// <see cref="WorkerLaunchOutcome"/> value, matching the "exceptions are for unrecoverable
    /// state" rule this type exists to satisfy.
    /// </remarks>
    public async Task<WorkerLaunchOutcome> Start(WorkerJob job, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();

        var (image, tag) = SplitImage(job.Image);
        try
        {
            await client.Images.CreateImageAsync(
                new ImagesCreateParameters { FromImage = image, Tag = tag },
                null,
                new Progress<JSONMessage>(),
                cancellationToken);
        }
        catch (DockerApiException exception)
        {
            // A locally built image is not pullable - use what the daemon already has.
            logger.CouldNotPullImage(exception, job.Image);
        }

        var response = await client.Containers.CreateContainerAsync(
            BuildContainerSpecification(job, options.Value.RepositoryCachePath, options.Value.RepositoryCacheEnvironmentVariable),
            cancellationToken);

        await WriteSecrets(client, response.ID, job, cancellationToken);

        await client.Containers.StartContainerAsync(response.ID, new ContainerStartParameters(), cancellationToken);
        logger.StartedWorkerContainer(response.ID, job.Session);
        return WorkerLaunchOutcome.Started;
    }

    /// <inheritdoc/>
    public async Task<bool?> IsAlive(AgentSessionId session, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        try
        {
            var container = await client.Containers.InspectContainerAsync(NameFor(session), cancellationToken);

            return container?.State?.Running ?? false;
        }
        catch (DockerContainerNotFoundException)
        {
            // No such container. That is a real answer rather than a failure to get one.
            return false;
        }
        catch (Exception exception)
        {
            // The daemon being unreachable says nothing about the worker, so refuse to guess -
            // reporting "gone" here would fail healthy work whenever Docker hiccups.
            logger.CouldNotReadWorkerState(exception, session);
            return null;
        }
    }

    /// <inheritdoc/>
    /// <remarks>
    /// Always <see langword="true"/> - a local Docker container has no comparable stuck-creating
    /// phase the way a Kubernetes pod does. <see cref="Start"/> already waits for the image to be
    /// present and the container created before it starts the container, so by the time a caller
    /// could observe this session as running, its container has started.
    /// </remarks>
    public Task<bool?> HasStarted(AgentSessionId session, CancellationToken cancellationToken = default) => Task.FromResult<bool?>(true);

    /// <inheritdoc/>
    public async Task Stop(AgentSessionId session, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        var name = NameFor(session);
        try
        {
            await client.Containers.StopContainerAsync(
                name,
                new ContainerStopParameters { WaitBeforeKillSeconds = StopGraceSeconds },
                cancellationToken);
            logger.StoppedWorkerContainer(session);
        }
        catch (DockerApiException exception)
        {
            // The container may already be gone - stopping is best effort.
            logger.CouldNotStopWorker(exception, session);
        }

        try
        {
            // The stop above leaves the container behind in an exited state, and its name is derived
            // from the session id - so a resumed session, which keeps its id on purpose, would
            // collide with it on the next launch.
            await client.Containers.RemoveContainerAsync(
                name,
                new ContainerRemoveParameters { Force = true },
                cancellationToken);
        }
        catch (DockerApiException exception)
        {
            logger.CouldNotStopWorker(exception, session);
        }
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The same thing as <see cref="Stop"/> here, and deliberately so: the removal it ends with is
    /// already forced, and a local daemon has no equivalent of a node that stops answering - the
    /// failure this exists for cannot happen on Docker.
    /// </remarks>
    public Task Purge(AgentSessionId session, CancellationToken cancellationToken = default) => Stop(session, cancellationToken);

    /// <inheritdoc/>
    public async IAsyncEnumerable<string> StreamLogs(AgentSessionId session, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        var channel = Channel.CreateUnbounded<string>();
        var pump = Task.Run(
            async () =>
            {
                try
                {
                    await client.Containers.GetContainerLogsAsync(
                        NameFor(session),
                        new ContainerLogsParameters
                        {
                            ShowStdout = true,
                            ShowStderr = true,
                            Follow = true,
                            Tail = "1000"
                        },
                        new Progress<string>(line => channel.Writer.TryWrite(line)),
                        cancellationToken);
                }
                catch (Exception exception)
                {
                    // The container may be gone or the client cancelled - the stream just ends.
                    logger.LogStreamEnded(exception, session);
                }
                finally
                {
                    channel.Writer.TryComplete();
                }
            },
            cancellationToken);

        await foreach (var line in channel.Reader.ReadAllAsync(cancellationToken))
        {
            yield return line;
        }

        await pump;
    }

    /// <inheritdoc/>
    public async Task SendInput(AgentSessionId session, string text, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        using var stream = await client.Containers.AttachContainerAsync(
            NameFor(session),
            new ContainerAttachParameters { Stream = true, Stdin = true },
            cancellationToken);
        var bytes = Encoding.UTF8.GetBytes($"{text}\n");
        await stream.WriteAsync(bytes, 0, bytes.Length, cancellationToken);
    }

    /// <summary>
    /// Builds the container/job name a session maps to - shared with <see cref="KubernetesWorkerRuntime"/>
    /// so both runtimes agree on one contract. Lower-cased and stripped to ASCII letters/digits only, so
    /// it is always a valid Docker container name and Kubernetes DNS-1123 label whatever shape the
    /// consumer's own <see cref="AgentSessionId"/> values take - both known consumers populate it from a
    /// <see cref="Guid"/>, which this always renders identically to the previous fixed
    /// <c>"direct-work-{id:N}"</c> format.
    /// </summary>
    /// <param name="session">The agent session.</param>
    /// <returns>The name.</returns>
    internal static string NameFor(AgentSessionId session)
    {
        var sanitized = new string([.. session.Value.Where(char.IsAsciiLetterOrDigit)]).ToLowerInvariant();
        return $"cratis-ai-agent-{sanitized}";
    }

    static async Task WriteSecrets(DockerClient client, string container, WorkerJob job, CancellationToken cancellationToken)
    {
        // A tmpfs is mounted when the container starts, so anything written into that path before
        // start would be masked by it. Copying into a created-but-not-started container puts the
        // file on the mount the entrypoint will read, and never on disk on the host.
        await using var archive = new MemoryStream();
        WriteTar(archive, job);
        archive.Position = 0;

        await client.Containers.ExtractArchiveToContainerAsync(
            container,
            new CopyToContainerParameters { Path = WorkerSecrets.Directory },
            archive,
            cancellationToken);
    }

    static void WriteTar(Stream stream, WorkerJob job)
    {
        // The readiness marker is written after the secrets file - and after the prompt, which is
        // the larger of the two and the one most likely to still be arriving - so the entrypoint
        // cannot observe a half-extracted file and read a truncated credential or instruction.
        WriteTarEntry(stream, WorkerSecrets.FileName, Encoding.UTF8.GetBytes(WorkerSecrets.Render(job.Secrets)));
        WriteTarEntry(
            stream,
            WorkerPromptFile.FileName,
            Encoding.UTF8.GetBytes(WorkerPromptFile.Clamp(
                job.EnvironmentVariables.GetValueOrDefault(WorkerPromptFile.LegacyVariableName, string.Empty))));
        foreach (var (name, content) in job.ConfigurationFiles ?? new Dictionary<string, string>())
        {
            WriteTarEntry(stream, name, Encoding.UTF8.GetBytes(content));
        }
        WriteTarEntry(stream, WorkerSecrets.ReadyFileName, Encoding.UTF8.GetBytes("ready\n"));
        stream.Write(new byte[1024]);
    }

    static void WriteTarEntry(Stream stream, string name, byte[] content)
    {
        var header = new byte[512];
        Encoding.ASCII.GetBytes(name).CopyTo(header, 0);
        Octal(header, 100, 8, 0b100_000_000);                       // mode 0400 - readable only by the owner
        Octal(header, 108, 8, 0);                                   // uid
        Octal(header, 116, 8, 0);                                   // gid
        Octal(header, 124, 12, content.Length);
        Octal(header, 136, 12, DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        header[156] = (byte)'0';                                    // a regular file
        Encoding.ASCII.GetBytes("ustar\0").CopyTo(header, 257);
        Encoding.ASCII.GetBytes("00").CopyTo(header, 263);

        // The checksum is computed with its own field read as spaces, then written into it.
        for (var index = 148; index < 156; index++)
        {
            header[index] = (byte)' ';
        }

        var checksum = header.Aggregate(0, (total, value) => total + value);
        Octal(header, 148, 7, checksum);
        header[154] = 0;
        header[155] = (byte)' ';

        stream.Write(header);
        stream.Write(content);

        var padding = (512 - (content.Length % 512)) % 512;
        stream.Write(new byte[padding]);
    }

    /// <summary>
    /// Writes a tar numeric field: octal digits, zero padded, NUL terminated.
    /// </summary>
    /// <param name="header">The header block to write into.</param>
    /// <param name="offset">The offset of the field.</param>
    /// <param name="length">The length of the field, including its terminator.</param>
    /// <param name="value">The value to write.</param>
    static void Octal(byte[] header, int offset, int length, long value)
    {
        var digits = Convert.ToString(value, 8).PadLeft(length - 1, '0');
        Encoding.ASCII.GetBytes(digits).CopyTo(header, offset);
        header[offset + length - 1] = 0;
    }

    static (string Image, string Tag) SplitImage(string image)
    {
        var separator = image.LastIndexOf(':');
        return separator > image.LastIndexOf('/')
            ? (image[..separator], image[(separator + 1)..])
            : (image, "latest");
    }

    DockerClient CreateClient()
    {
        // The builder resolves the endpoint the same way the docker CLI does (DOCKER_HOST, contexts,
        // platform default socket) unless an explicit endpoint is configured.
        var builder = new DockerClientBuilder();
        if (!string.IsNullOrEmpty(options.Value.DockerEndpoint))
        {
            builder = builder.WithEndpoint(new Uri(options.Value.DockerEndpoint));
        }

        return builder.Build();
    }
}
