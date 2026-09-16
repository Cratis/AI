// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Runtime.CompilerServices;
using Cratis.AI.Usage;
using k8s;
using k8s.Autorest;
using k8s.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Workers;

/// <summary>
/// An <see cref="IWorkerRuntime"/> that launches worker containers as Kubernetes jobs - the
/// runtime used when a consumer runs in a cluster. Ported from Direct's
/// <c>Work.Workers.KubernetesWorkerRuntime</c> (plan Section 5.6), <c>WorkId</c> generalized to
/// <see cref="AgentSessionId"/> and <c>ContainerRuntimeOptions</c> to <see cref="WorkerRuntimeOptions"/>.
/// </summary>
/// <param name="options">The <see cref="WorkerRuntimeOptions"/> configuring the namespace.</param>
/// <param name="logger">The logger.</param>
/// <param name="clientFactory">
/// Builds the <see cref="IKubernetes"/> client one operation talks to the cluster through -
/// <see langword="null"/> (the default) uses the real <see cref="KubernetesClientFactory"/>. The
/// seam exists so a spec can substitute a fake client and exercise <see cref="Launch"/>'s decision not
/// to delete a live worker, without either shape needing to know about the other's reason for being.
/// </param>
public class KubernetesWorkerRuntime(
    IOptions<WorkerRuntimeOptions> options,
    ILogger<KubernetesWorkerRuntime> logger,
    IKubernetesClientFactory? clientFactory = null) : IWorkerRuntime
{
    const string SecretVolumeName = "agent-secrets";

    /// <summary>
    /// The pod label, and NetworkPolicy selector, identifying a worker pod. Renamed from Direct's
    /// original <c>direct.cratis.io/workload</c> to be product-neutral - a consumer's own
    /// NetworkPolicy (or equivalent) must select on this exact value once it adopts this runtime.
    /// </summary>
    const string WorkerWorkloadLabel = "cratis.io/agent-workload";
    const string WorkerWorkloadLabelValue = "worker";

    /// <summary>
    /// The node label, and matching toleration key, that pins a worker Job to a node pool - a
    /// cross-repository contract with whatever Pulumi program provisions the cluster's node pools.
    /// Both sides must agree on it exactly.
    /// </summary>
    const string NodePoolLabelKey = "workload";

    /// <summary>
    /// How long Kubernetes waits between the SIGTERM it sends a stopped or evicted worker pod and
    /// the SIGKILL that follows it.
    /// </summary>
    /// <remarks>
    /// A worker's commits only leave its throwaway container because <c>entrypoint.sh</c> pushes
    /// them, and on a stop or an eviction it does that from its SIGTERM trap - so this window is how
    /// long that push has to finish before the container, and everything committed in it, is
    /// destroyed. The Kubernetes default is 30 seconds, which is a push of a large repository over
    /// HTTPS on a bad day; this is deliberately generous because it costs nothing when it is not
    /// needed. Kubernetes stops waiting the moment the process exits, and the entrypoint exits as
    /// soon as it has pushed.
    /// </remarks>
    const long TerminationGracePeriodSeconds = 120;

    /// <summary>
    /// The hard ceiling Kubernetes itself enforces on how long a worker Job's pod may run before the
    /// Job is marked <c>Failed</c>, whatever the pod's own state.
    /// </summary>
    /// <remarks>
    /// A last-resort net rather than the primary defense - a consumer's own scheduling options and
    /// the <c>HasStarted</c>-driven startup grace already cover the ordinary cases from inside its
    /// own process. This exists for the case those cannot: on 2026-09-02 the donor deployment's own
    /// backend pod could not start at all (an unreachable NFS export), so nothing in the process was
    /// running to notice six worker pods stuck in <c>ContainerCreating</c> for over ninety minutes -
    /// the one thing that kept working throughout was the Kubernetes control plane itself. Sized
    /// generously above the donor's own scheduling-duration default so it never fires ahead of the
    /// ordinary sweep; it only acts when nothing else can. Once it fires, the Job moves to
    /// <c>Failed</c>, which flows into the existing <see cref="Aliveness"/> recovery path once the
    /// consumer's own process is healthy again to see it.
    /// </remarks>
    const long ActiveDeadlineSeconds = 48 * 60 * 60;

    /// <summary>
    /// The numeric UID (and GID) the <c>agent</c> user is pinned to, both here and in
    /// <c>Source/AgentHarnesses/Dockerfile.base</c>'s <c>useradd --uid</c>. The two must stay in
    /// lockstep: see the comment on <see cref="BuildJobSpecification"/>'s <c>SecurityContext</c> for
    /// why a numeric UID has to be pinned at all, and why it isn't 1000 or 1654.
    /// </summary>
    const long AgentUid = 1655;

    readonly IKubernetesClientFactory _clients = clientFactory ?? new KubernetesClientFactory();

    static Dictionary<string, string> ManagedByCratisAI => new() { ["app.kubernetes.io/managed-by"] = "cratis-ai-agents" };

    // A dedicated pod label is the stable NetworkPolicy identity for callback traffic. The broader
    // managed-by label also appears on Jobs and Secrets and may legitimately grow to cover other
    // consumer-created pods; it is therefore not a safe long-term authorization selector.
    static Dictionary<string, string> WorkerPodLabels => new(ManagedByCratisAI)
    {
        [WorkerWorkloadLabel] = WorkerWorkloadLabelValue
    };

    /// <summary>
    /// Builds the Job specification for a worker - the object that ends up in
    /// <c>kubectl get job -o yaml</c>, and therefore the one that must carry no credential.
    /// </summary>
    /// <param name="job">The worker job to describe.</param>
    /// <param name="repositoryCachePath">
    /// The path to mount the shared repository cache at, from
    /// <see cref="WorkerRuntimeOptions.RepositoryCachePath"/> - <see langword="null"/> or empty (the
    /// default) omits the volume, its mount and the repository-cache environment variable entirely.
    /// Local/Docker dev leaves this unset and is unaffected.
    /// </param>
    /// <param name="repositoryCacheClaimName">
    /// The name of the <c>PersistentVolumeClaim</c> to mount, from
    /// <see cref="WorkerRuntimeOptions.RepositoryCacheClaimName"/>.
    /// </param>
    /// <param name="repositoryCacheEnvironmentVariable">
    /// The environment variable name a consumer's own <c>entrypoint.sh</c> reads the mounted cache
    /// path from, from <see cref="WorkerRuntimeOptions.RepositoryCacheEnvironmentVariable"/>.
    /// </param>
    /// <param name="imagePullSecretName">
    /// The name of the <c>kubernetes.io/dockerconfigjson</c> Secret to pull the worker image with, from
    /// <see cref="WorkerRuntimeOptions.ImagePullSecretName"/> - <see langword="null"/> or empty (the
    /// default) omits <c>imagePullSecrets</c> entirely, correct for a public worker image.
    /// </param>
    /// <param name="nodePoolWorkload">
    /// The node pool workload to pin the Job to, from <see cref="WorkerRuntimeOptions.NodePoolWorkload"/> -
    /// <see langword="null"/> or empty (the default) omits the node selector and toleration entirely, so
    /// the Job can land on any node.
    /// </param>
    /// <param name="resources">
    /// What the worker container reserves and is bounded by, from the worker-runtime options -
    /// <see langword="null"/> or <see cref="WorkerResources.None"/> declares nothing.
    /// </param>
    /// <returns>The Job specification.</returns>
    public static V1Job BuildJobSpecification(
        WorkerJob job,
        string? repositoryCachePath = null,
        string? repositoryCacheClaimName = null,
        string? repositoryCacheEnvironmentVariable = null,
        string? imagePullSecretName = null,
        string? nodePoolWorkload = null,
        WorkerResources? resources = null)
    {
        var name = DockerWorkerRuntime.NameFor(job.Session);

        var volumes = new List<V1Volume>
        {
            new()
            {
                Name = SecretVolumeName,

                // Kubernetes always owns a mounted Secret's files as root:root, regardless of the
                // container's runAsUser - there is no PodSecurityContext.FsGroup set here to change
                // that. The worker container runs as the non-root "agent" user (Dockerfile.base), so
                // an owner-only mode (0400) is unreadable by the very process meant to read it. 0444
                // is the mode that is actually readable inside this single-user, single-purpose
                // container - restricting it further would need an FsGroup to go with it.
                Secret = new V1SecretVolumeSource { SecretName = name, DefaultMode = 292 }
            }
        };

        var volumeMounts = new List<V1VolumeMount>
        {
            new()
            {
                Name = SecretVolumeName,
                MountPath = WorkerSecrets.Directory,
                ReadOnlyProperty = true
            }
        };

        // Only non-secret configuration goes on the specification. The credentials arrive through
        // the mount above, so `kubectl get job -o yaml` shows a volume reference rather than a token.
        //
        // The prompt is left off it too, and for a harder reason than taste: a single environment
        // variable over MAX_ARG_STRLEN makes the kernel refuse the whole execve, so a large enough
        // prompt means the container never starts at all. It travels as a file - see
        // WorkerPromptFile - and what goes here is the path to it.
        List<V1EnvVar> env =
        [
            .. job.EnvironmentVariables
                .Where(variable => variable.Key != WorkerPromptFile.LegacyVariableName)
                .Select(variable => new V1EnvVar { Name = variable.Key, Value = variable.Value }),
            new() { Name = WorkerSecrets.PathVariableName, Value = WorkerSecrets.Path },
            new() { Name = WorkerPromptFile.PathVariableName, Value = WorkerPromptFile.Path }
        ];

        if (!string.IsNullOrWhiteSpace(repositoryCachePath) && !string.IsNullOrWhiteSpace(repositoryCacheClaimName))
        {
            // Read-only, on the claim and on the mount both, and that is a security boundary rather
            // than an optimization: the consumer's own pod runs `git` inside these mirrors with far
            // more privilege than this worker has, and a git repository a lower-trust principal can
            // write is a git repository that decides what the higher-trust one executes - a planted
            // `hooks/pre-receive` or a rewritten `remote.origin.url` is enough. This container only
            // ever reads the cache anyway; it takes its checkout with `git clone --shared`, which
            // borrows objects without writing any (see Source/AgentHarnesses/entrypoint.sh).
            //
            // Kubernetes lets any number of pods mount the same RWX PVC concurrently - this worker
            // and every other one, plus the consumer's own pod, which is the single writer and is
            // what keeps it current from GitHub push webhooks. Referenced by name only; the
            // consumer's own infrastructure provisions the claim itself.
            volumes.Add(new V1Volume
            {
                Name = repositoryCacheClaimName,
                PersistentVolumeClaim = new V1PersistentVolumeClaimVolumeSource
                {
                    ClaimName = repositoryCacheClaimName,
                    ReadOnlyProperty = true
                }
            });
            volumeMounts.Add(new V1VolumeMount
            {
                Name = repositoryCacheClaimName,
                MountPath = repositoryCachePath,
                ReadOnlyProperty = true
            });
            if (!string.IsNullOrWhiteSpace(repositoryCacheEnvironmentVariable))
            {
                env.Add(new V1EnvVar { Name = repositoryCacheEnvironmentVariable, Value = repositoryCachePath });
            }
        }

        return new V1Job
        {
            Metadata = new V1ObjectMeta
            {
                Name = name,
                Labels = ManagedByCratisAI
            },
            Spec = new V1JobSpec
            {
                BackoffLimit = 0,
                TtlSecondsAfterFinished = 3600,
                ActiveDeadlineSeconds = ActiveDeadlineSeconds,
                Template = new V1PodTemplateSpec
                {
                    // The pod carries the label too, not just the Job. Kubernetes copies neither -
                    // it adds its own job-name and controller-uid and nothing else - and the spread
                    // constraint below selects on this one, so without it every worker is a topology
                    // domain of one and the constraint quietly does nothing.
                    Metadata = new V1ObjectMeta { Labels = WorkerPodLabels },
                    Spec = new V1PodSpec
                    {
                        RestartPolicy = "Never",

                        // A worker runs untrusted, prompt-injectable model output (Cratis/Stagehand#246);
                        // it has no legitimate reason to talk to the Kubernetes API, and an unmounted
                        // token is one a foothold there cannot use to widen itself.
                        AutomountServiceAccountToken = false,

                        // Every image this Job ever runs (Source/AgentHarnesses/Dockerfile.base and its
                        // derivatives) ends its build with `USER agent` - a *named* user, not a numeric
                        // one. The kubelet cannot resolve a name to a UID from outside the container to
                        // verify RunAsNonRoot against, so with no RunAsUser here it refuses to start the
                        // container at all: "container has runAsNonRoot and image has non-numeric user
                        // (agent), cannot verify user is non-root" - every single time, not
                        // intermittently. RunAsUser/RunAsGroup must therefore be pinned to the exact
                        // numeric UID/GID `useradd` assigns `agent` in Dockerfile.base, and the two are
                        // kept in lockstep deliberately: bump one, bump the other. It is 1655, not the
                        // usual 1000, because the dotnet/sdk:10.0 base image already takes 1654 for its
                        // own `app` user.
                        //
                        // ReadOnlyRootFilesystem is deliberately absent, unlike a terminal pod's: a
                        // worker's whole job is to clone a repository and run its build into the
                        // container's own writable layer, so a read-only root would fail every session
                        // immediately. That layer's growth is what EphemeralStorageLimit bounds instead
                        // (Cratis/Stagehand#461).
                        SecurityContext = new V1PodSecurityContext
                        {
                            RunAsNonRoot = true,
                            RunAsUser = AgentUid,
                            RunAsGroup = AgentUid,
                            SeccompProfile = new V1SeccompProfile { Type = "RuntimeDefault" }
                        },
                        TerminationGracePeriodSeconds = TerminationGracePeriodSeconds,
                        Volumes = volumes,
                        ImagePullSecrets = string.IsNullOrWhiteSpace(imagePullSecretName)
                            ? null
                            : [new V1LocalObjectReference { Name = imagePullSecretName }],
                        NodeSelector = string.IsNullOrWhiteSpace(nodePoolWorkload)
                            ? null
                            : new Dictionary<string, string> { [NodePoolLabelKey] = nodePoolWorkload },
                        Tolerations = string.IsNullOrWhiteSpace(nodePoolWorkload)
                            ? null
                            :
                            [
                                new V1Toleration
                                {
                                    Key = NodePoolLabelKey,
                                    OperatorProperty = "Equal",
                                    Value = nodePoolWorkload,
                                    Effect = "NoSchedule"
                                }
                            ],

                        // Spread the workers over the nodes rather than letting the scheduler stack
                        // them. This is a preference on top of whatever `resources` declares, not a
                        // substitute for it: the requests are what the scheduler actually prices a
                        // worker at, and this only breaks ties between nodes that can take one.
                        //
                        // It used to be the only thing resisting a pile-up, because a worker declared
                        // no resources at all and so cost nothing as far as the scheduler was
                        // concerned. On 2026-09-01 that emptied two nodes' kubelets in one evening:
                        // fourteen workers on compute-gphgj-bjt8k, then seven on compute-gphgj-9td8c,
                        // each going NotReady with "Kubelet stopped posting node status" and taking
                        // every worker on it with it. On 2026-09-02 it did it again to three more
                        // nodes in ninety minutes, that time taking production down with them, which
                        // is what finally produced the measurement the requests are sized from
                        // (Cratis/Stagehand#438, Cratis/Stagehand#529).
                        //
                        // ScheduleAnyway, deliberately: a hard constraint would leave workers Pending
                        // when the cluster genuinely has no room, which trades an occasional dead node
                        // for a silent dispatch stall - a worse failure.
                        TopologySpreadConstraints =
                        [
                            new V1TopologySpreadConstraint
                            {
                                MaxSkew = 1,
                                TopologyKey = "kubernetes.io/hostname",
                                WhenUnsatisfiable = "ScheduleAnyway",
                                LabelSelector = new V1LabelSelector { MatchLabels = WorkerPodLabels }
                            }
                        ],
                        Containers =
                        [
                            new V1Container
                            {
                                Name = "worker",
                                Image = job.Image,
                                Env = env,
                                VolumeMounts = volumeMounts,
                                Resources = (resources ?? WorkerResources.None).ToRequirements(),

                                // The entrypoint hands the harness CLI its prompt through a pipe
                                // whose writers are a session-long holder and a feeder reading the
                                // container's real stdin through a dup'd fd (entrypoint.sh, run_pi/
                                // run_claude_code). This container allocating stdin is what makes
                                // that feeder actually receive steering lines: Docker's OpenStdin
                                // keeps the stream open across attach sessions, and the Kubernetes
                                // counterpart is Stdin = true with StdinOnce left false - without
                                // it, reads on the container's stdin are EOF, the feeder exits, and
                                // steering (SendInput) is silently dead while the session itself
                                // survives on the holder. Allocating stdin also matches the Docker
                                // runtime's OpenStdin, so both runtimes hand the entrypoint the same
                                // contract.
                                Stdin = true,

                                // No capability in the default set is one a repository build legitimately
                                // needs - CHOWN/DAC_OVERRIDE/SETUID/SETGID and the rest are what the base
                                // image's own USER already sidesteps by not being root in the first place.
                                SecurityContext = new V1SecurityContext
                                {
                                    AllowPrivilegeEscalation = false,
                                    Capabilities = new V1Capabilities { Drop = ["ALL"] }
                                }
                            }
                        ]
                    }
                }
            }
        };
    }

    /// <summary>
    /// Whether a worker's Job is still going to produce something.
    /// </summary>
    /// <param name="job">The Job as the API server has it.</param>
    /// <returns><see langword="true"/> when alive, <see langword="false"/> when gone, <see langword="null"/> when it cannot be told.</returns>
    /// <remarks>
    /// <c>Active</c> counts pods that are running. A Job with no active pod and no recorded success
    /// or failure is between attempts, which is still alive as far as the work is concerned -
    /// Kubernetes will start the next pod itself.
    /// <para>
    /// Unless it is on its way out. A Job being deleted will start nothing further whatever its
    /// counters say - and its counters say exactly the same thing as one waiting to start a pod: no
    /// active, no succeeded, no failed. Reading that as alive is what left six sessions
    /// <c>Running</c> against pods evicted from an unreachable node on 2026-09-01: nothing resumed
    /// them, because nothing believed they had stopped, and the only thing that would ever have
    /// moved them was a duration sweep hours later.
    /// </para>
    /// </remarks>
    public static bool? Aliveness(V1Job? job)
    {
        if (job?.Status is not { } status)
        {
            return null;
        }

        var active = (status.Active ?? 0) > 0;

        return job.Metadata?.DeletionTimestamp is not null
            ? active
            : active || ((status.Succeeded ?? 0) == 0 && (status.Failed ?? 0) == 0);
    }

    /// <summary>
    /// Whether a worker's pod has actually started, as distinct from <see cref="Aliveness"/> - a Job's
    /// counters read exactly the same for "about to start a pod" and "pod stuck in <c>Pending</c> and
    /// never leaving it", so this asks the pod itself.
    /// </summary>
    /// <param name="pod">The worker's pod, as the API server has it - the first one <c>job-name</c>
    /// selects, since a worker Job never has more than one.</param>
    /// <returns><see langword="true"/> when started, <see langword="false"/> when confirmed still
    /// <c>Pending</c>, <see langword="null"/> when there is no pod to ask.</returns>
    public static bool? Started(V1Pod? pod)
    {
        if (pod is null)
        {
            // No pod at all is unknown rather than "not started" - the Job may not have created one
            // yet, or it has already been cleaned up. Neither says anything about whether the
            // container itself ever ran.
            return null;
        }

        return pod.Status?.Phase != "Pending";
    }

    /// <inheritdoc/>
    /// <exception cref="WorkerLaunchWasRefused">
    /// Thrown when the launch failed for a reason that is about the cluster rather than the work, so
    /// the scheduler leaves it queued and tries again instead of failing it.
    /// </exception>
    public async Task Start(WorkerJob job, CancellationToken cancellationToken = default)
    {
        try
        {
            await Launch(job, cancellationToken);
        }
        catch (Exception exception) when (WorkerLaunchWasRefused.IsAboutTheCluster(exception))
        {
            throw new WorkerLaunchWasRefused(job.Session, exception);
        }
    }

    /// <inheritdoc/>
    public async Task Purge(AgentSessionId session, CancellationToken cancellationToken = default)
    {
        using var client = _clients.Create();
        var name = DockerWorkerRuntime.NameFor(session);

        await RemovePods(client, name, cancellationToken);

        try
        {
            await client.BatchV1.DeleteNamespacedJobAsync(
                name,
                options.Value.KubernetesNamespace,
                propagationPolicy: "Background",
                cancellationToken: cancellationToken);
        }
        catch (HttpOperationException exception) when (exception.Response.StatusCode == HttpStatusCode.NotFound)
        {
            // Already gone, which is the outcome this method exists to reach.
        }
        catch (Exception exception)
        {
            logger.CouldNotStopWorker(exception, session);
        }

        await ReleaseFinalizers(client, name, cancellationToken);
        await DeleteSecret(client, name, cancellationToken);
        logger.PurgedWorkerLeftovers(name, session);
    }

    /// <inheritdoc/>
    public async Task<bool?> IsAlive(AgentSessionId session, CancellationToken cancellationToken = default)
    {
        using var client = _clients.Create();
        try
        {
            var job = await client.BatchV1.ReadNamespacedJobAsync(
                DockerWorkerRuntime.NameFor(session),
                options.Value.KubernetesNamespace,
                cancellationToken: cancellationToken);

            return Aliveness(job);
        }
        catch (HttpOperationException exception) when (exception.Response.StatusCode == HttpStatusCode.NotFound)
        {
            // The job is gone. Kubernetes deletes a job's own record once its TTL expires, so this
            // is the ordinary shape of "that worker no longer exists" rather than an error.
            return false;
        }
        catch (Exception exception)
        {
            // Anything else is the API being unreachable or unhappy, which says nothing about the
            // worker. Reporting "gone" here would fail healthy work whenever the cluster hiccups.
            logger.CouldNotReadWorkerState(exception, session);
            return null;
        }
    }

    /// <inheritdoc/>
    /// <remarks>
    /// A pod stuck in <c>Pending</c> - most commonly <c>ContainerCreating</c> behind a mount that
    /// never completes - is indistinguishable from ordinary scheduling delay in every other signal
    /// this runtime exposes: <see cref="IsAlive"/> reads the Job's counters, which say exactly the
    /// same thing for "about to start" and "stuck starting". This asks the pod itself.
    /// </remarks>
    public async Task<bool?> HasStarted(AgentSessionId session, CancellationToken cancellationToken = default)
    {
        using var client = _clients.Create();
        try
        {
            var pods = await client.CoreV1.ListNamespacedPodAsync(
                options.Value.KubernetesNamespace,
                labelSelector: $"job-name={DockerWorkerRuntime.NameFor(session)}",
                cancellationToken: cancellationToken);
            return Started(pods.Items.FirstOrDefault());
        }
        catch (Exception exception)
        {
            // The API being unreachable says nothing about the worker - refuse to guess.
            logger.CouldNotReadWorkerState(exception, session);
            return null;
        }
    }

    /// <inheritdoc/>
    public async Task Stop(AgentSessionId session, CancellationToken cancellationToken = default)
    {
        using var client = _clients.Create();
        try
        {
            await client.BatchV1.DeleteNamespacedJobAsync(
                DockerWorkerRuntime.NameFor(session),
                options.Value.KubernetesNamespace,
                propagationPolicy: "Foreground",
                cancellationToken: cancellationToken);
            logger.StoppedWorkerContainer(session);
        }
        catch (Exception exception)
        {
            // The job may already be gone - stopping is best effort.
            logger.CouldNotStopWorker(exception, session);
        }

        // Owner references clean this up with the job, but only when the job was actually adopted -
        // deleting it here too means a stop always takes the credentials with it.
        await DeleteSecret(client, DockerWorkerRuntime.NameFor(session), cancellationToken);
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<string> StreamLogs(AgentSessionId session, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using var client = _clients.Create();
        var pods = await client.CoreV1.ListNamespacedPodAsync(
            options.Value.KubernetesNamespace,
            labelSelector: $"job-name={DockerWorkerRuntime.NameFor(session)}",
            cancellationToken: cancellationToken);
        var pod = pods.Items.FirstOrDefault();
        if (pod is null)
        {
            yield break;
        }

        await using var stream = await client.CoreV1.ReadNamespacedPodLogAsync(
            pod.Metadata.Name,
            options.Value.KubernetesNamespace,
            container: "worker",
            follow: true,
            cancellationToken: cancellationToken);
        using var reader = new StreamReader(stream);
        while (!cancellationToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line is null)
            {
                yield break;
            }

            yield return line;
        }
    }

    /// <inheritdoc/>
    public async Task SendInput(AgentSessionId session, string text, CancellationToken cancellationToken = default)
    {
        using var client = _clients.Create();
        var pods = await client.CoreV1.ListNamespacedPodAsync(
            options.Value.KubernetesNamespace,
            labelSelector: $"job-name={DockerWorkerRuntime.NameFor(session)}",
            cancellationToken: cancellationToken);
        var pod = pods.Items.FirstOrDefault();
        if (pod is null)
        {
            return;
        }

        using var webSocket = await client.WebSocketNamespacedPodAttachAsync(
            pod.Metadata.Name,
            options.Value.KubernetesNamespace,
            container: "worker",
            stderr: false,
            stdin: true,
            stdout: false,
            cancellationToken: cancellationToken);

        // Channel-framed attach protocol: the first byte selects the stream - 0 is stdin.
        var payload = System.Text.Encoding.UTF8.GetBytes($"{text}\n");
        var framed = new byte[payload.Length + 1];
        payload.CopyTo(framed, 1);
        await webSocket.SendAsync(framed, System.Net.WebSockets.WebSocketMessageType.Binary, true, cancellationToken);
        await webSocket.CloseAsync(System.Net.WebSockets.WebSocketCloseStatus.NormalClosure, "done", cancellationToken);
    }

    async Task Launch(WorkerJob job, CancellationToken cancellationToken)
    {
        using var client = _clients.Create();

        var name = DockerWorkerRuntime.NameFor(job.Session);

        // Scheduled work is only ever dispatched because nothing believes it has a live container -
        // but "nothing believes" is a statement about the read model, not about the cluster, and the
        // two can disagree (Cratis/Stagehand#500: a launch whose acknowledgement was lost left the
        // work Scheduled while its worker kept running; the next pass re-dispatched it). Asking the
        // cluster directly, rather than trusting the assumption, is what makes the removal below safe
        // rather than destructive.
        await GuardAgainstLiveWorker(client, name, job.Session, cancellationToken);

        // Clear anything a previous attempt at this same session left behind.
        //
        // Both the job and its secret are named from the session id, and a resumed session keeps
        // its id on purpose - that is what keeps its branch and the commits already pushed to it.
        // So a re-dispatch collides with the dead attempt's leftovers:
        //
        //   secrets "cratis-ai-agent-<id>" already exists (409 Conflict)
        //
        // and the launch fails. The work is then still not running, so the next pass finds it
        // abandoned and resumes it again, and again, each round burning a dispatch and getting no
        // further. The guard above is what makes "removing what is there is safe" true rather than
        // assumed.
        await RemovePreviousAttempt(client, name, cancellationToken);

        // The secret is created before the job so the pod never starts against a missing mount, and
        // it is adopted by the job afterwards so Kubernetes garbage-collects it with the job rather
        // than leaving the credentials behind.
        var secret = await client.CoreV1.CreateNamespacedSecretAsync(
            new V1Secret
            {
                Metadata = new V1ObjectMeta
                {
                    Name = name,
                    Labels = ManagedByCratisAI
                },
                Type = "Opaque",

                // entrypoint.sh waits for the readiness marker, not just the secrets file's
                // existence, to tell a complete file from one the Docker runtime is still copying
                // in - a distinction that never applies to a Kubernetes Secret volume (mounted
                // atomically, whole, before the container starts), but the entrypoint is shared
                // across both runtimes and only knows the one wait. Without this key the marker
                // never appears and every worker times out after the entrypoint's wait and starts
                // with no credentials at all.
                StringData = BuildMountedFiles(job)
            },
            options.Value.KubernetesNamespace,
            cancellationToken: cancellationToken);

        var kubernetesJob = BuildJobSpecification(
            job,
            options.Value.RepositoryCachePath,
            options.Value.RepositoryCacheClaimName,
            options.Value.RepositoryCacheEnvironmentVariable,
            options.Value.ImagePullSecretName,
            options.Value.NodePoolWorkload,
            new WorkerResources(
                options.Value.CpuRequest,
                options.Value.CpuLimit,
                options.Value.MemoryRequest,
                options.Value.MemoryLimit,
                options.Value.EphemeralStorageRequest,
                options.Value.EphemeralStorageLimit));

        try
        {
            var created = await client.BatchV1.CreateNamespacedJobAsync(kubernetesJob, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
            await AdoptSecret(client, secret, created, cancellationToken);
        }
        catch (HttpOperationException conflict) when (conflict.Response?.StatusCode == HttpStatusCode.Conflict)
        {
            // The Job is named after the session, so the name is taken until the previous one has
            // finished terminating. That is a "not yet" rather than a failure, and saying so is what
            // keeps the work scheduled for the next pass instead of failed and invisible.
            //
            // Unless it has been "not yet" for longer than any shutdown takes, in which case it is
            // never going to finish on its own and the answer is to take the leftovers away - see
            // ReleaseIfStuck for what makes that happen and why it has to.
            if (!await ReleaseIfStuck(client, name, job.Session, cancellationToken))
            {
                await DeleteSecret(client, name, cancellationToken);
                throw new WorkerIsStillGoingAway(job.Session, conflict);
            }

            try
            {
                var created = await client.BatchV1.CreateNamespacedJobAsync(kubernetesJob, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
                await AdoptSecret(client, secret, created, cancellationToken);
            }
            catch (Exception)
            {
                await DeleteSecret(client, name, cancellationToken);
                throw;
            }
        }
        catch (Exception)
        {
            // Nothing owns the secret yet, so a failed job creation would strand it with the
            // credentials in it.
            await DeleteSecret(client, name, cancellationToken);
            throw;
        }

        logger.CreatedKubernetesJob(name, job.Session);
    }

    /// <summary>
    /// Refuses to launch a new worker over one that is still actually running - the check that makes
    /// <see cref="RemovePreviousAttempt"/> safe to call unconditionally afterwards.
    /// </summary>
    /// <param name="client">The Kubernetes client.</param>
    /// <param name="name">The job name a new launch would reuse.</param>
    /// <param name="session">The agent session being launched, for the exception.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    /// <exception cref="WorkerIsAlreadyRunning">
    /// Thrown when the previous attempt's Job is still alive and not on its way out - deleting it here
    /// would destroy a container that is genuinely running the work (Cratis/Stagehand#500).
    /// </exception>
    /// <remarks>
    /// Deliberately narrow: a Job that is already being deleted is left to <see cref="ReleaseIfStuck"/>
    /// below, which knows how long "still terminating" is allowed to take before its leftovers are
    /// taken away - this only ever stops a launch over a Job nothing has asked to go anywhere. A read
    /// that fails for a reason other than "no such Job" is left to propagate rather than guessed at
    /// here - <see cref="Start"/> already turns a cluster-side failure into <see cref="WorkerLaunchWasRefused"/>,
    /// which is the right outcome for "cannot tell" exactly as it is for the launch itself.
    /// </remarks>
    async Task GuardAgainstLiveWorker(IKubernetes client, string name, AgentSessionId session, CancellationToken cancellationToken)
    {
        V1Job existing;
        try
        {
            existing = await client.BatchV1.ReadNamespacedJobAsync(name, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
        }
        catch (HttpOperationException exception) when (exception.Response.StatusCode == HttpStatusCode.NotFound)
        {
            // Nothing there - the ordinary case for a first dispatch, and for one whose only leftover
            // has already finished.
            return;
        }

        if (Aliveness(existing) == true && existing.Metadata?.DeletionTimestamp is null)
        {
            throw new WorkerIsAlreadyRunning(session);
        }
    }

    /// <summary>
    /// Removes the job and secret a previous attempt at the same session left behind, so a
    /// re-dispatch does not collide with them.
    /// </summary>
    /// <param name="client">The Kubernetes client.</param>
    /// <param name="name">The job and secret name, which is the same for both.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    async Task RemovePreviousAttempt(IKubernetes client, string name, CancellationToken cancellationToken)
    {
        try
        {
            await client.BatchV1.DeleteNamespacedJobAsync(
                name,
                options.Value.KubernetesNamespace,
                propagationPolicy: "Foreground",
                cancellationToken: cancellationToken);
        }
        catch (HttpOperationException exception) when (exception.Response.StatusCode == HttpStatusCode.NotFound)
        {
            // Nothing to clear - the ordinary case for a first dispatch.
        }

        try
        {
            await client.CoreV1.DeleteNamespacedSecretAsync(name, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
        }
        catch (HttpOperationException exception) when (exception.Response.StatusCode == HttpStatusCode.NotFound)
        {
            // Owner references usually take the secret with the job, so this is expected to be a
            // no-op whenever the job above existed.
        }
    }

    /// <summary>
    /// Takes away the leftovers of a worker that has been shutting down for longer than any shutdown
    /// takes, so the name it is holding becomes free.
    /// </summary>
    /// <param name="client">The Kubernetes client.</param>
    /// <param name="name">The job and secret name, which is the same for both.</param>
    /// <param name="session">The agent session whose worker is in the way, for the log.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns><see langword="true"/> when the name was released and the launch is worth retrying.</returns>
    /// <remarks>
    /// A Job deleted with foreground propagation carries a <c>foregroundDeletion</c> finalizer until
    /// every pod it owns is confirmed deleted. A pod on a node that has stopped reporting can never
    /// be confirmed, so the Job stays in the API server with the name, and every launch after it
    /// answers <c>409 object is being deleted</c> - forever, with nothing in the system able to
    /// resolve it. Removing the pods by force and then the finalizer is what a person does by hand;
    /// doing it here is what keeps it from needing a person.
    /// <para>
    /// Bounded by <see cref="WorkerRuntimeOptions.StuckWorkerGrace"/> rather than done on sight,
    /// because a worker that is genuinely terminating is still pushing what it committed from its
    /// SIGTERM trap, and taking its pod away mid-push destroys exactly the work it is trying to save.
    /// </para>
    /// </remarks>
    async Task<bool> ReleaseIfStuck(IKubernetes client, string name, AgentSessionId session, CancellationToken cancellationToken)
    {
        V1Job existing;
        try
        {
            existing = await client.BatchV1.ReadNamespacedJobAsync(name, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
        }
        catch (Exception exception)
        {
            // It answered 409 a moment ago, so failing to read it now says the cluster is unhappy
            // rather than that anything is stuck. Leave it be and let the next pass try again.
            logger.CouldNotReadWorkerState(exception, session);
            return false;
        }

        if (existing?.Metadata?.DeletionTimestamp is not { } deleting)
        {
            // Not being deleted at all - the name is taken by something live, which the caller's
            // "still going away" answer describes correctly.
            return false;
        }

        var terminatingFor = DateTime.UtcNow - deleting.ToUniversalTime();
        if (terminatingFor < options.Value.StuckWorkerGrace)
        {
            return false;
        }

        logger.ReleasingStuckWorkerJob(name, session, terminatingFor);
        await RemovePods(client, name, cancellationToken);
        await ReleaseFinalizers(client, name, cancellationToken);
        await DeleteSecret(client, name, cancellationToken);
        return true;
    }

    /// <summary>
    /// Removes a job's pods without waiting for the node holding them to agree - the API-level
    /// equivalent of <c>kubectl delete pod --force --grace-period=0</c>.
    /// </summary>
    /// <param name="client">The Kubernetes client.</param>
    /// <param name="name">The job name, which is what its pods are labelled with.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    async Task RemovePods(IKubernetes client, string name, CancellationToken cancellationToken)
    {
        try
        {
            await client.CoreV1.DeleteCollectionNamespacedPodAsync(
                options.Value.KubernetesNamespace,
                new V1DeleteOptions { GracePeriodSeconds = 0 },
                gracePeriodSeconds: 0,
                labelSelector: $"job-name={name}",
                cancellationToken: cancellationToken);
        }
        catch (Exception exception)
        {
            // Best effort - removing the finalizer below is what actually frees the name, and a pod
            // left behind with no owner is garbage-collected on its own.
            logger.CouldNotRemoveWorkerPods(exception, name);
        }
    }

    /// <summary>
    /// Clears whatever finalizers are holding a deleted job in the API server.
    /// </summary>
    /// <param name="client">The Kubernetes client.</param>
    /// <param name="name">The job name.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    async Task ReleaseFinalizers(IKubernetes client, string name, CancellationToken cancellationToken)
    {
        try
        {
            await client.BatchV1.PatchNamespacedJobAsync(
                new V1Patch("{\"metadata\":{\"finalizers\":null}}", V1Patch.PatchType.MergePatch),
                name,
                options.Value.KubernetesNamespace,
                cancellationToken: cancellationToken);
        }
        catch (HttpOperationException exception) when (exception.Response.StatusCode == HttpStatusCode.NotFound)
        {
            // Gone the moment its last dependent was - which is the point of the patch, so arriving
            // here means the removal above was enough on its own.
        }
        catch (Exception exception)
        {
            logger.CouldNotReleaseWorkerJob(exception, name);
        }
    }

    Dictionary<string, string> BuildMountedFiles(WorkerJob job)
    {
        var files = new Dictionary<string, string>
        {
            [WorkerSecrets.FileName] = WorkerSecrets.Render(job.Secrets),
            [WorkerPromptFile.FileName] = WorkerPromptFile.Clamp(
                job.EnvironmentVariables.GetValueOrDefault(WorkerPromptFile.LegacyVariableName, string.Empty)),
        };
        foreach (var (name, content) in job.ConfigurationFiles ?? new Dictionary<string, string>())
        {
            files[name] = content;
        }
        files[WorkerSecrets.ReadyFileName] = string.Empty;
        return files;
    }

    async Task AdoptSecret(IKubernetes client, V1Secret secret, V1Job job, CancellationToken cancellationToken)
    {
        secret.Metadata.OwnerReferences =
        [
            new V1OwnerReference
            {
                ApiVersion = "batch/v1",
                Kind = "Job",
                Name = job.Metadata.Name,
                Uid = job.Metadata.Uid,
                BlockOwnerDeletion = true
            }
        ];

        await client.CoreV1.ReplaceNamespacedSecretAsync(
            secret,
            secret.Metadata.Name,
            options.Value.KubernetesNamespace,
            cancellationToken: cancellationToken);
    }

    async Task DeleteSecret(IKubernetes client, string name, CancellationToken cancellationToken)
    {
        try
        {
            await client.CoreV1.DeleteNamespacedSecretAsync(name, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
        }
        catch (Exception exception)
        {
            // Already gone, or garbage-collected with the job - either way the credentials are not
            // left behind, which is the only thing this guarantees.
            logger.CouldNotDeleteWorkerSecret(exception, name);
        }
    }
}
