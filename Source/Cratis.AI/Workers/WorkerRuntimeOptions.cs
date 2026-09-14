// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// The kind of container runtime a consumer schedules workers on.
/// </summary>
public enum ContainerRuntimeType
{
    /// <summary>
    /// Detect the environment automatically - Kubernetes when running in a cluster, otherwise the local Docker daemon.
    /// </summary>
    Auto = 0,

    /// <summary>
    /// The local Docker daemon - the default when running and testing locally.
    /// </summary>
    Docker = 1,

    /// <summary>
    /// A Kubernetes cluster - the typical production environment.
    /// </summary>
    Kubernetes = 2,
}

/// <summary>
/// The configuration for the container runtime workers are scheduled on, bound from a consumer's
/// <c>ContainerRuntime</c> configuration section. Ported from Direct's
/// <c>Containers.ContainerRuntimeOptions</c> (plan Section 5.6) - the incident-derived remarks behind
/// the resource fields are preserved verbatim, since they are the reasoning, not the product.
/// </summary>
public class WorkerRuntimeOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Cratis:AI:ContainerRuntime";

    /// <summary>
    /// Gets or sets the kind of runtime to use.
    /// </summary>
    public ContainerRuntimeType Type { get; set; } = ContainerRuntimeType.Auto;

    /// <summary>
    /// Gets or sets the Docker daemon endpoint. Defaults to the <c>DOCKER_HOST</c> environment
    /// variable when set, otherwise the platform's local daemon socket.
    /// </summary>
    public string? DockerEndpoint { get; set; }

    /// <summary>
    /// Gets or sets the Kubernetes namespace worker jobs are created in.
    /// </summary>
    public string KubernetesNamespace { get; set; } = "default";

    /// <summary>
    /// Gets or sets the name of the <c>kubernetes.io/dockerconfigjson</c> Secret worker jobs pull their
    /// image with. Unset (the default) omits <c>imagePullSecrets</c> from the job spec entirely, which is
    /// correct for a public worker image; a worker image served from a private registry needs this set to
    /// the pull secret the consumer's own deployment creates in the same namespace. Only meaningful for
    /// the Kubernetes runtime.
    /// </summary>
    public string? ImagePullSecretName { get; set; }

    /// <summary>
    /// Gets or sets the node pool workload worker Jobs are pinned to via a <c>workload</c> node
    /// selector plus a matching toleration - a label/taint convention for keeping bursty agent-session
    /// workloads off the nodes running the consumer's own services on a shared cluster. Unset or empty
    /// (the default) omits the node selector and toleration entirely, so a worker Job can land on any
    /// node - correct for a cluster that has no such node pool. Only meaningful for the Kubernetes
    /// runtime.
    /// </summary>
    public string? NodePoolWorkload { get; set; }

    /// <summary>
    /// Gets or sets the CPU a worker container reserves, as a Kubernetes quantity (<c>"1"</c>,
    /// <c>"500m"</c>). Unset (the default) declares no request.
    /// </summary>
    /// <remarks>
    /// The request is what the scheduler prices a worker at, and pricing it at zero is what let a
    /// whole fleet stack onto one node until its kubelet stopped reporting - three times in one day
    /// for the donor deployment this was ported from (Cratis/Stagehand#438). Measured over 12 hours
    /// across 105 workers there, a worker's CPU peak was 0.36 cores at the median and 3.10 at the
    /// maximum, so a request near the median with a limit above it spreads them without stalling the
    /// long tail.
    /// </remarks>
    public string? CpuRequest { get; set; }

    /// <summary>
    /// Gets or sets the CPU ceiling a worker container is throttled to, as a Kubernetes quantity.
    /// Unset (the default) declares no limit.
    /// </summary>
    /// <remarks>
    /// CPU is compressible: exceeding this limit slows a worker down, it never kills it. That makes a
    /// CPU limit the one bound that can protect a node's kubelet from a busy worker without ever
    /// costing an agent session - unlike <see cref="MemoryLimit"/>, which kills.
    /// </remarks>
    public string? CpuLimit { get; set; }

    /// <summary>
    /// Gets or sets the memory a worker container reserves, as a Kubernetes quantity (<c>"2Gi"</c>).
    /// Unset (the default) declares no request.
    /// </summary>
    public string? MemoryRequest { get; set; }

    /// <summary>
    /// Gets or sets the memory ceiling a worker container is killed at, as a Kubernetes quantity.
    /// Unset (the default) declares no limit.
    /// </summary>
    /// <remarks>
    /// Memory is not compressible: a worker that crosses this is OOM-killed outright, losing the
    /// agent session. Size it against the observed peak rather than the median - over 12 hours across
    /// 130 workers in the donor deployment the median peak was 475 MiB but the maximum was 3529 MiB,
    /// so a 2 GiB ceiling would have killed roughly one run in five.
    /// </remarks>
    public string? MemoryLimit { get; set; }

    /// <summary>
    /// Gets or sets the ephemeral storage a worker container reserves, as a Kubernetes quantity
    /// (<c>"3Gi"</c>). Unset (the default) declares no request.
    /// </summary>
    /// <remarks>
    /// A worker's repository clone and build output land on ephemeral storage, and pricing it at
    /// zero is what emptied node disks and evicted pods across two incidents in the donor deployment
    /// (Cratis/Stagehand#438: <c>Container worker was using 2521252Ki, request is 0</c>).
    /// </remarks>
    public string? EphemeralStorageRequest { get; set; }

    /// <summary>
    /// Gets or sets the ephemeral storage ceiling a worker container is evicted at, as a Kubernetes
    /// quantity (<c>"20Gi"</c>). Unset (the default) declares no limit.
    /// </summary>
    /// <remarks>
    /// A build's checkout and output land on ephemeral storage rather than a sized volume, so an
    /// unbounded worker can fill a node's disk one build at a time - the same incident
    /// <see cref="EphemeralStorageRequest"/> documents. Generous relative to the request: builds
    /// churn (dependency restores, incremental output, node_modules) well above their steady-state
    /// footprint, and the limit's job is to turn a runaway outlier into its own eviction rather than
    /// bound the ordinary case (Cratis/Stagehand#461).
    /// </remarks>
    public string? EphemeralStorageLimit { get; set; }

    /// <summary>
    /// Gets or sets how long a worker that is shutting down is given to finish doing so before its
    /// leftovers are removed by force.
    /// </summary>
    /// <remarks>
    /// A worker Job is named after the session it runs, so its name is taken until it has finished
    /// terminating - which is why a re-dispatch that collides with one leaves the work scheduled and
    /// tries again later. That is right for a worker that is genuinely on its way out, and wrong
    /// forever for one that is not: Kubernetes waits for confirmation that the Job's pod is gone, and
    /// a pod on a node that has stopped reporting can never give it. The grace is what separates the
    /// two, so it is comfortably longer than the pod's own termination grace
    /// (<c>TerminationGracePeriodSeconds</c>) plus the time Kubernetes needs to act on it. Only
    /// meaningful for the Kubernetes runtime; the Docker runtime removes a container by force anyway.
    /// </remarks>
    public TimeSpan StuckWorkerGrace { get; set; } = TimeSpan.FromMinutes(5);
}
