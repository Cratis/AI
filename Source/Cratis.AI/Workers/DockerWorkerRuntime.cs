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
/// <remarks>
/// Secure delivery assumes an owner-trusted image selected by a digest allow-list at the caller.
/// Image code runs before delivery and supplies the verification tools; this is not a sandbox for
/// hostile images. Root publishes readiness only after worker-identity payload checks complete.
/// </remarks>
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
    /// <param name="hostWorkspacePath">The prevalidated canonical host workspace path, or null for the legacy clone path.</param>
    /// <param name="hostGitMetadataPath">The prevalidated internal gitfile metadata subtree to protect, when applicable.</param>
    /// <returns>The container creation parameters.</returns>
    /// <exception cref="ArgumentException">The cache request is invalid.</exception>
    /// <exception cref="DockerWorkerLaunchFailed">
    /// The job supplies execution-affecting environment variables such as PATH, LD_*, or shell startup overrides.
    /// These names are rejected case-insensitively before container creation.
    /// </exception>
    public static CreateContainerParameters BuildContainerSpecification(
        WorkerJob job,
        string? repositoryCachePath = null,
        string? repositoryCacheEnvironmentVariable = null,
        string? hostWorkspacePath = null,
        string? hostGitMetadataPath = null) => BuildContainerSpecification(job, new SpecificationInputs
        {
            CachePath = repositoryCachePath, CacheVariable = repositoryCacheEnvironmentVariable,
            HostWorkspacePath = hostWorkspacePath, HostGitMetadataPath = hostGitMetadataPath
        });

    /// <summary>
    /// Builds a container specification using prevalidated scoped cache binds resolved on the Docker host.
    /// </summary>
    /// <param name="job">The worker job.</param>
    /// <param name="cacheBinds">The resolved read-only mirror and writable memory-directory binds.</param>
    /// <param name="repositoryCachePath">The configured cache root.</param>
    /// <param name="repositoryCacheEnvironmentVariable">The configured cache variable.</param>
    /// <returns>The container specification.</returns>
    /// <exception cref="ArgumentException">The cache request is invalid.</exception>
    public static CreateContainerParameters BuildContainerSpecificationWithCacheBinds(
        WorkerJob job, IReadOnlyList<string> cacheBinds, string? repositoryCachePath = null, string? repositoryCacheEnvironmentVariable = null)
    {
        var plan = WorkerCacheMounts.Create(job.Cache);
        if (plan.AppliesTo(job, repositoryCachePath))
        {
            var allowed = plan.MirrorPaths.Select(repository => $"{WorkerCacheMounts.ContainerPath(repositoryCachePath!, repository)}:{WorkerCacheMounts.ContainerPath(repositoryCachePath!, repository)}:ro")
                .Append($"{WorkerCacheMounts.ContainerPath(repositoryCachePath!, plan.MemoryDirectory)}:{WorkerCacheMounts.ContainerPath(repositoryCachePath!, plan.MemoryDirectory)}:rw")
                .ToHashSet(StringComparer.Ordinal);
            if (cacheBinds.Any(bind => !allowed.Contains(bind)))
            {
                throw new ArgumentException("Cache binds must match the job's selected directories and access modes.", nameof(cacheBinds));
            }
        }
        return BuildContainerSpecification(job, new SpecificationInputs { CachePath = repositoryCachePath, CacheVariable = repositoryCacheEnvironmentVariable, CacheBinds = cacheBinds });
    }

    static CreateContainerParameters BuildContainerSpecification(WorkerJob job, SpecificationInputs inputs)
    {
        WorkerSecrets.ValidateNames(job.Secrets, inputs.CacheVariable);
        var hostPrepared = inputs.HostWorkspacePath is not null;
        var cache = WorkerCacheMounts.Create(job.Cache);
        var binds = cache.AppliesTo(job, inputs.CachePath, hostPrepared) ? inputs.CacheBinds : [];

        return new()
        {
            Image = job.Image,
            Labels = job.Labels is { Count: > 0 } labels ? new Dictionary<string, string>(labels, StringComparer.Ordinal) : null!,

            // Only non-secret configuration goes on the container specification, because
            // `docker inspect` reads it back and it outlives the container. Credentials are
            // streamed into the tmpfs below instead; what is named here is a path, not a secret.
            Name = NameFor(job.Session),

            // The prompt is left off for a harder reason than the credentials are: a single
            // environment variable over MAX_ARG_STRLEN makes the kernel refuse the whole execve, so
            // a large enough prompt stops the container starting at all. It is copied in as a file
            // below - see WorkerPromptFile - and what goes here is the path to it.
            Env = BuildEnvironment(job, inputs with { CachePath = binds.Count > 0 ? inputs.CachePath : null }),

            // A TTY keeps the log a single raw stream, which also gives a live console a clean
            // line-by-line feed. Stdin stays open so steering text can be sent to the running session.
            Tty = true,
            OpenStdin = true,
            StdinOnce = false,
            HostConfig = BuildHostConfiguration(job, inputs with { CacheBinds = binds })
        };
    }

    static List<string> BuildEnvironment(WorkerJob job, SpecificationInputs inputs)
    {
        var filteredJob = job with
        {
            EnvironmentVariables = job.EnvironmentVariables
                .Where(variable => IsJobEnvironmentVariable(variable.Key, inputs))
                .ToDictionary(variable => variable.Key, variable => variable.Value)
        };
        return
        [
            .. new DockerWorkerEnvironment(filteredJob, inputs.CachePath, inputs.CacheVariable, inputs.HostWorkspacePath is not null).Build(),
            $"{WorkerSecrets.RequiredVariableName}=true"
        ];
    }

    static bool IsJobEnvironmentVariable(string name, SpecificationInputs inputs)
    {
        if (IsExecutionEnvironmentVariable(name))
        {
            throw new DockerWorkerLaunchFailed();
        }
        return !name.Contains('=') && !name.Contains('\0') &&
            !IsRuntimeEnvironmentVariable(name, inputs);
    }

    static bool IsRuntimeEnvironmentVariable(string name, SpecificationInputs inputs) =>
        name.Equals(WorkerSecrets.PathVariableName, StringComparison.OrdinalIgnoreCase) ||
        name.Equals(WorkerSecrets.RequiredVariableName, StringComparison.OrdinalIgnoreCase) ||
        name.Equals(WorkerPromptFile.PathVariableName, StringComparison.OrdinalIgnoreCase) ||
        name.Equals(WorkerPromptFile.LegacyVariableName, StringComparison.OrdinalIgnoreCase) ||
        WorkerCacheMounts.IsEnvironmentVariable(name, inputs.CacheVariable);

    /// <summary>Determines whether a secret name is reserved by the runtime.</summary>
    /// <param name="name">The environment name.</param>
    /// <param name="cacheVariable">The configured cache environment name.</param>
    /// <returns>Whether the name must not be supplied as a secret.</returns>
    internal static bool IsReservedEnvironmentVariable(string name, string? cacheVariable) =>
        IsExecutionEnvironmentVariable(name) ||
        IsRuntimeEnvironmentVariable(name, new SpecificationInputs { CacheVariable = cacheVariable }) ||
        name.Equals(HostWorkspace.ModeVariable, StringComparison.OrdinalIgnoreCase) ||
        name.Equals(HostWorkspace.ContainerPathVariable, StringComparison.OrdinalIgnoreCase) ||
        name.Equals(HostWorkspace.HostPathVariable, StringComparison.OrdinalIgnoreCase) ||
        name.Equals("DIRECT_REPOSITORY_CHECKOUTS", StringComparison.OrdinalIgnoreCase);

    static bool IsExecutionEnvironmentVariable(string name) => name.ToUpperInvariant() switch
    {
        "PATH" or "BASH_ENV" or "ENV" or "SHELLOPTS" or "BASHOPTS" or "IFS" or "PS4" or "PROMPT_COMMAND" or
        "GLIBC_TUNABLES" or "GCONV_PATH" or "LOCPATH" or "NLSPATH" or "CDPATH" or "BASH_COMPAT" or "BASH_XTRACEFD" => true,
        var variable => variable.StartsWith("LD_", StringComparison.Ordinal) ||
            variable.StartsWith("DYLD_", StringComparison.Ordinal) ||
            variable.StartsWith("MALLOC_", StringComparison.Ordinal) ||
            variable.StartsWith("BASH_FUNC_", StringComparison.Ordinal)
    };

    static void ValidateLimits(WorkerLimits? limits)
    {
        if (limits is { MemoryBytes: < 0 } or { NanoCpus: < 0 } or { PidsLimit: < 0 })
        {
            throw new DockerWorkerLaunchFailed();
        }
    }

    static HostConfig BuildHostConfiguration(WorkerJob job, SpecificationInputs inputs)
    {
        ValidateLimits(job.Limits);
        var configuration = new HostConfig
        {
            // Docker Desktop provides this alias; Linux engines need it explicitly.
            ExtraHosts = ["host.docker.internal:host-gateway"],
            Memory = job.Limits?.MemoryBytes ?? 0,
            MemorySwap = job.Limits?.MemoryBytes ?? 0,
            MemorySwappiness = 0,
            NanoCPUs = job.Limits?.NanoCpus ?? 0,
            PidsLimit = job.Limits is { PidsLimit: not 0 } limits ? limits.PidsLimit : null,

            // Never deliver credentials into the writable layer.
            Tmpfs = new Dictionary<string, string>
            {
                [WorkerSecrets.Directory] = "rw,noexec,nosuid,nodev,size=16m,mode=0700,uid=1655,gid=1655",
                [WorkerSecrets.DockerReadyDirectory] = "rw,noexec,nosuid,nodev,size=1m,mode=0755,uid=0,gid=0"
            },

            // Host-prepared workspaces protect Git metadata and never expose the shared mirror.
            Binds = inputs.HostWorkspacePath is not null
                ? BuildHostWorkspaceBinds(inputs.HostWorkspacePath, inputs.HostGitMetadataPath)
                : [.. inputs.CacheBinds]
        };
        if (inputs.HardenContainer)
        {
            configuration.Privileged = false;
            configuration.CapDrop = ["ALL"];
            configuration.SecurityOpt = ["no-new-privileges:true"];
        }
        return configuration;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// Returns <see cref="WorkerLaunchOutcome.InvalidWorkspace"/> before contacting Docker for an
    /// invalid host-prepared request. Otherwise <see cref="WorkerLaunchOutcome.Started"/> on return - a local Docker daemon has no
    /// equivalent of the anticipated "previous worker still around" cases <see cref="KubernetesWorkerRuntime"/>
    /// has to account for. A genuine failure here (the daemon itself unreachable) is unrecoverable
    /// from this runtime's own perspective and propagates as an exception rather than a
    /// <see cref="WorkerLaunchOutcome"/> value, matching the "exceptions are for unrecoverable
    /// state" rule this type exists to satisfy.
    /// </remarks>
    public async Task<WorkerLaunchOutcome> Start(WorkerJob job, CancellationToken cancellationToken = default)
    {
        var verdict = HostWorkspace.Validate(job, options.Value.HostWorkspaceRoot);
        if (verdict.Kind is not (HostWorkspaceVerdictKind.NotHostPrepared or HostWorkspaceVerdictKind.Valid))
        {
            logger.InvalidHostWorkspace(job.Session, verdict.Kind);
            return WorkerLaunchOutcome.InvalidWorkspace;
        }
        WorkerSecrets.ValidateNames(job.Secrets, options.Value.RepositoryCacheEnvironmentVariable);
        if (!TryPrepareCache(job, verdict.Path is not null, out _)) return WorkerLaunchOutcome.InvalidCache;
        using var client = CreateClient();

        return await Start(client, job, verdict, cancellationToken);
    }

    /// <summary>
    /// Launches using the supplied engine connection.
    /// </summary>
    /// <param name="client">The Docker client.</param>
    /// <param name="job">The worker job.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The successful launch outcome.</returns>
    /// <exception cref="DockerWorkerLaunchFailed">Secure delivery failed; engine details are withheld.</exception>
    internal async Task<WorkerLaunchOutcome> Start(IDockerClient client, WorkerJob job, CancellationToken cancellationToken = default)
    {
        var verdict = HostWorkspace.Validate(job, options.Value.HostWorkspaceRoot);
        if (verdict.Kind is not (HostWorkspaceVerdictKind.NotHostPrepared or HostWorkspaceVerdictKind.Valid))
        {
            logger.InvalidHostWorkspace(job.Session, verdict.Kind);
            return WorkerLaunchOutcome.InvalidWorkspace;
        }
        WorkerSecrets.ValidateNames(job.Secrets, options.Value.RepositoryCacheEnvironmentVariable);
        if (!TryPrepareCache(job, verdict.Path is not null, out _)) return WorkerLaunchOutcome.InvalidCache;
        return await Start(client, job, verdict, cancellationToken);
    }

    async Task<WorkerLaunchOutcome> Start(IDockerClient client, WorkerJob job, HostWorkspaceVerdict verdict, CancellationToken cancellationToken)
    {
        await PullImage(client, job, cancellationToken);
        if (!TryPrepareCache(job, verdict.Path is not null, out var cacheBinds)) return WorkerLaunchOutcome.InvalidCache;

        CreateContainerResponse response;
        try
        {
            response = await client.Containers.CreateContainerAsync(
                BuildContainerSpecification(job, new SpecificationInputs
                {
                    CachePath = options.Value.RepositoryCachePath, CacheVariable = options.Value.RepositoryCacheEnvironmentVariable,
                    HardenContainer = options.Value.DockerHardeningEnabled, HostWorkspacePath = verdict.Path,
                    HostGitMetadataPath = verdict.GitMetadataPath, CacheBinds = cacheBinds
                }),
                cancellationToken);
        }
        catch (Exception)
        {
            throw new DockerWorkerLaunchFailed();
        }

        try
        {
            if (!await client.Containers.StartContainerAsync(response.ID, new ContainerStartParameters(), cancellationToken))
            {
                throw new DockerWorkerLaunchFailed();
            }
            await new DockerWorkerSecrets(client, response.ID, cancellationToken).Inject(job);
        }
        catch (Exception)
        {
            // Docker errors can contain request bodies. Never expose the original exception,
            // including as InnerException, and do not let caller cancellation skip cleanup.
            using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            try
            {
                await client.Containers.RemoveContainerAsync(response.ID, new ContainerRemoveParameters { Force = true, RemoveVolumes = true }, cleanup.Token);
            }
            catch (Exception)
            {
                throw new DockerWorkerLaunchFailed(cleanupFailed: true);
            }
            throw new DockerWorkerLaunchFailed();
        }
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
    /// phase the way a Kubernetes pod does. <see cref="Start(WorkerJob, CancellationToken)"/> already waits for the image to be
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

    static List<string> BuildHostWorkspaceBinds(string workspace, string? metadata)
    {
        return
        [
            $"{workspace}:{HostWorkspace.ContainerPath}:rw",
            $"{Path.Combine(workspace, ".git")}:{HostWorkspace.ContainerPath}/.git:ro",
            .. metadata is null ? (string[])[] : [$"{metadata}:{HostWorkspace.ContainerPath}/{Path.GetRelativePath(workspace, metadata)}:ro"]
        ];
    }

    /// <summary>
    /// Separates mutable tags without splitting an immutable digest reference.
    /// </summary>
    /// <param name="image">The image reference.</param>
    /// <returns>The image and optional tag used for pulling.</returns>
    internal static (string Image, string Tag) SplitImage(string image)
    {
        if (image.Contains('@'))
        {
            return (image, string.Empty);
        }

        var separator = image.LastIndexOf(':');
        return separator > image.LastIndexOf('/')
            ? (image[..separator], image[(separator + 1)..])
            : (image, "latest");
    }

    async Task PullImage(IDockerClient client, WorkerJob job, CancellationToken cancellationToken)
    {
        var (image, tag) = SplitImage(job.Image);
        try
        {
            await client.Images.CreateImageAsync(
                new ImagesCreateParameters { FromImage = image, Tag = tag },
                null,
                new Progress<JSONMessage>(),
                cancellationToken);
        }
        catch (DockerApiException)
        {
            // A locally built image is not pullable - use what the daemon already has.
            // Engine errors are untrusted and may include credentials.
            logger.CouldNotPullImage(new InvalidOperationException("Docker image pull failed; engine diagnostics withheld."), job.Image);
        }
    }

    bool TryPrepareCache(WorkerJob job, bool hostPrepared, out IReadOnlyList<string> binds)
    {
        binds = [];
        if (!WorkerCacheMounts.TryCreate(job.Cache, out var plan))
        {
            logger.InvalidWorkerCache(job.Session, plan.Reason);
            return false;
        }
        var root = options.Value.RepositoryCachePath;
        var resolved = WorkerCacheHostPaths.Resolve(plan, root, plan.AppliesTo(job, root, hostPrepared));
        if (!resolved.IsValid)
        {
            logger.InvalidWorkerCache(job.Session, resolved.Reason);
            return false;
        }
        if (resolved.HasMissingRepositories) logger.MissingWorkerCacheRepository(job.Session);
        binds = resolved.Binds;
        return true;
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

    sealed record SpecificationInputs
    {
        internal string? CachePath { get; init; }
        internal string? CacheVariable { get; init; }
        internal IReadOnlyList<string> CacheBinds { get; init; } = [];
        internal bool HardenContainer { get; init; }
        internal string? HostWorkspacePath { get; init; }
        internal string? HostGitMetadataPath { get; init; }
    }
}
