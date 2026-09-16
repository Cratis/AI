// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s.Models;

namespace Cratis.AI.Workers;

/// <summary>
/// What a worker container reserves and is bounded by, as Kubernetes quantities. Ported from
/// Direct's <c>Work.Workers.WorkerResources</c> (plan Section 5.6) unchanged - nothing about it was
/// Direct-specific.
/// </summary>
/// <param name="CpuRequest">The CPU reserved, or <see langword="null"/> to declare none.</param>
/// <param name="CpuLimit">The CPU ceiling, or <see langword="null"/> to declare none.</param>
/// <param name="MemoryRequest">The memory reserved, or <see langword="null"/> to declare none.</param>
/// <param name="MemoryLimit">The memory ceiling, or <see langword="null"/> to declare none.</param>
/// <param name="EphemeralStorageRequest">The ephemeral storage reserved, or <see langword="null"/> to declare none.</param>
/// <param name="EphemeralStorageLimit">
/// The ephemeral storage ceiling a worker container is evicted at, or <see langword="null"/> to
/// declare none. Unlike CPU and memory, there is no per-container OOM kill for disk - a container
/// that outgrows this is evicted by the kubelet instead, which is what turns a runaway worker's
/// build churn into its own eviction rather than the node's (Cratis/Stagehand#461).
/// </param>
/// <remarks>
/// Grouped rather than passed as more arguments because they are one decision: what a worker
/// costs. Every value is optional and an unset one is omitted from the spec rather than defaulted,
/// so a cluster that has not been sized keeps the behaviour it had before this existed.
/// </remarks>
public record WorkerResources(
    string? CpuRequest = null,
    string? CpuLimit = null,
    string? MemoryRequest = null,
    string? MemoryLimit = null,
    string? EphemeralStorageRequest = null,
    string? EphemeralStorageLimit = null)
{
    /// <summary>
    /// Nothing declared - the scheduler prices the worker at zero and nothing bounds it.
    /// </summary>
    public static readonly WorkerResources None = new();

    /// <summary>
    /// Whether anything at all is declared.
    /// </summary>
    public bool IsSet =>
        !string.IsNullOrWhiteSpace(CpuRequest) ||
        !string.IsNullOrWhiteSpace(CpuLimit) ||
        !string.IsNullOrWhiteSpace(MemoryRequest) ||
        !string.IsNullOrWhiteSpace(MemoryLimit) ||
        !string.IsNullOrWhiteSpace(EphemeralStorageRequest) ||
        !string.IsNullOrWhiteSpace(EphemeralStorageLimit);

    /// <summary>
    /// Builds the container's resource requirements.
    /// </summary>
    /// <returns>
    /// The requirements, or <see langword="null"/> when nothing is declared - which leaves
    /// <c>resources</c> off the container entirely rather than writing an empty one.
    /// </returns>
    public V1ResourceRequirements? ToRequirements()
    {
        if (!IsSet)
        {
            return null;
        }

        var requests = Quantities(CpuRequest, MemoryRequest, EphemeralStorageRequest);
        var limits = Quantities(CpuLimit, MemoryLimit, EphemeralStorageLimit);

        return new V1ResourceRequirements
        {
            Requests = requests.Count == 0 ? null : requests,
            Limits = limits.Count == 0 ? null : limits
        };
    }

    static Dictionary<string, ResourceQuantity> Quantities(string? cpu, string? memory, string? ephemeralStorage)
    {
        var quantities = new Dictionary<string, ResourceQuantity>();

        if (!string.IsNullOrWhiteSpace(cpu))
        {
            quantities["cpu"] = new ResourceQuantity(cpu);
        }

        if (!string.IsNullOrWhiteSpace(memory))
        {
            quantities["memory"] = new ResourceQuantity(memory);
        }

        if (!string.IsNullOrWhiteSpace(ephemeralStorage))
        {
            quantities["ephemeral-storage"] = new ResourceQuantity(ephemeralStorage);
        }

        return quantities;
    }
}
