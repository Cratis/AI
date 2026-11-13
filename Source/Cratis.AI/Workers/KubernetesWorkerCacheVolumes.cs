// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s.Models;

namespace Cratis.AI.Workers;

/// <summary>
/// Builds per-directory PVC mounts. Repository mirrors remain read-only; only the selected
/// memory directory is writable. The claim itself must support read-write attachment.
/// </summary>
internal sealed class KubernetesWorkerCacheVolumes
{
    /// <summary>Gets the optional read-write claim attachment.</summary>
    internal V1Volume? Volume { get; private init; }

    /// <summary>Gets the scoped read-only mirror and writable memory mounts.</summary>
    internal IReadOnlyList<V1VolumeMount> Mounts { get; private init; } = [];

    /// <summary>Gets the runtime-owned cache environment.</summary>
    internal IReadOnlyList<V1EnvVar> Environment { get; private init; } = [];

    /// <summary>Builds scoped volumes for a valid cache request.</summary>
    /// <param name="job">The worker job.</param>
    /// <param name="root">The configured cache root.</param>
    /// <param name="claim">The configured claim name.</param>
    /// <param name="variable">The configured cache variable.</param>
    /// <returns>The optional cache volume, mounts and environment.</returns>
    internal static KubernetesWorkerCacheVolumes Build(WorkerJob job, string? root, string? claim, string? variable)
    {
        var plan = WorkerCacheMounts.Create(job.Cache);
        if (!plan.AppliesTo(job, root) || string.IsNullOrWhiteSpace(claim)) return new();
        return new()
        {
            Volume = new() { Name = claim, PersistentVolumeClaim = new() { ClaimName = claim, ReadOnlyProperty = false } },
            Mounts = [.. plan.Repositories.Select(repository => Mount(claim, root!, repository, true)), Mount(claim, root!, plan.MemoryDirectory, false)],
            Environment = plan.Environment(root!, variable).Select(pair => new V1EnvVar { Name = pair.Key, Value = pair.Value }).ToArray()
        };
    }

    static V1VolumeMount Mount(string claim, string root, string relative, bool readOnly) =>
        new() { Name = claim, SubPath = relative, MountPath = WorkerCacheMounts.ContainerPath(root, relative), ReadOnlyProperty = readOnly };
}
