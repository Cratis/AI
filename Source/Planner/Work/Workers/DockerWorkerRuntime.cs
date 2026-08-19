// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;
using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Options;

namespace Planner.Work.Workers;

/// <summary>
/// An <see cref="IWorkerRuntime"/> that launches worker containers directly on the Docker engine -
/// the runtime used when running and testing locally.
/// </summary>
/// <param name="options">The <see cref="ContainerRuntimeOptions"/> configuring the Docker endpoint.</param>
/// <param name="logger">The logger.</param>
public class DockerWorkerRuntime(IOptions<ContainerRuntimeOptions> options, ILogger<DockerWorkerRuntime> logger) : IWorkerRuntime
{
    /// <summary>
    /// Builds the container specification for a worker - what <c>docker inspect</c> reads back, and
    /// therefore what must carry no credential.
    /// </summary>
    /// <param name="job">The worker job to describe.</param>
    /// <returns>The container creation parameters.</returns>
    public static CreateContainerParameters BuildContainerSpecification(WorkerJob job) =>
        new()
        {
            Image = job.Image,

            // Only non-secret configuration goes on the container specification, because
            // `docker inspect` reads it back and it outlives the container. Credentials are
            // copied into the tmpfs below instead; what is named here is a path, not a secret.
            Name = ContainerNameFor(job.Work),
            Env =
            [
                .. job.EnvironmentVariables.Select(variable => $"{variable.Key}={variable.Value}"),
                $"{WorkerSecrets.PathVariableName}={WorkerSecrets.Path}"
            ],

            // A TTY keeps the log a single raw stream, which also gives the live console a
            // clean line-by-line feed. Stdin stays open so steering text can be sent to the
            // running session.
            Tty = true,
            OpenStdin = true,
            StdinOnce = false,
            HostConfig = new HostConfig
            {
                // Lets the container reach the Planner's callback endpoint on the host from Linux
                // engines; Docker Desktop provides the alias out of the box.
                ExtraHosts = ["host.docker.internal:host-gateway"],

                // The secrets land on a memory-backed mount, so they never touch the container's
                // writable layer and cannot be recovered from a committed image or a stopped
                // container's filesystem.
                Tmpfs = new Dictionary<string, string> { [WorkerSecrets.Directory] = "rw,noexec,nosuid,mode=0700" }
            }
        };

    /// <inheritdoc/>
    public async Task Start(WorkerJob job, CancellationToken cancellationToken = default)
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

        var response = await client.Containers.CreateContainerAsync(BuildContainerSpecification(job), cancellationToken);

        await WriteSecrets(client, response.ID, job, cancellationToken);

        await client.Containers.StartContainerAsync(response.ID, new ContainerStartParameters(), cancellationToken);
        logger.StartedWorkerContainer(response.ID, job.Work);
    }

    /// <inheritdoc/>
    public async Task Stop(WorkId work, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        try
        {
            await client.Containers.RemoveContainerAsync(
                ContainerNameFor(work),
                new ContainerRemoveParameters { Force = true },
                cancellationToken);
            logger.StoppedWorkerContainer(work);
        }
        catch (DockerApiException exception)
        {
            // The container may already be gone - stopping is best effort.
            logger.CouldNotStopWorker(exception, work);
        }
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<string> StreamLogs(WorkId work, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        var channel = Channel.CreateUnbounded<string>();
        var pump = Task.Run(
            async () =>
            {
                try
                {
                    await client.Containers.GetContainerLogsAsync(
                        ContainerNameFor(work),
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
                    logger.LogStreamEnded(exception, work);
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
    public async Task SendInput(WorkId work, string text, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        using var stream = await client.Containers.AttachContainerAsync(
            ContainerNameFor(work),
            new ContainerAttachParameters { Stream = true, Stdin = true },
            cancellationToken);
        var bytes = Encoding.UTF8.GetBytes($"{text}\n");
        await stream.WriteAsync(bytes, 0, bytes.Length, cancellationToken);
    }

    static string ContainerNameFor(WorkId work) => $"planner-work-{work.Value:N}";

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
        // The readiness marker is written after the secrets file so the entrypoint cannot observe a
        // half-extracted file and read a truncated credential.
        WriteTarEntry(stream, WorkerSecrets.FileName, Encoding.UTF8.GetBytes(WorkerSecrets.Render(job.Secrets)));
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
