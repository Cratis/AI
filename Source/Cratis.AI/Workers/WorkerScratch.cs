// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s.Models;

namespace Cratis.AI.Workers;

/// <summary>
/// A volume that holds a worker's workspace for exactly as long as the worker runs, instead of the
/// container's own writable layer on the node's disk.
/// </summary>
/// <param name="StorageClassName">
/// The storage class each worker's volume is provisioned from, or <see langword="null"/> to keep the
/// workspace in the container layer. The class should delete the volume when its claim goes and bind
/// only once the pod is scheduled, so the volume lands where the worker does.
/// </param>
/// <param name="Size">The size of each worker's volume, as a Kubernetes quantity (<c>"30Gi"</c>).</param>
/// <remarks>
/// <para>
/// A checkout and its build output are most of what a worker writes. In the container layer that
/// competes for the node's disk with every image and every other worker on it, which ties a pool to
/// large disks and lets one busy node evict the rest. On a volume of its own each worker gets the
/// same room wherever it lands, and the node disk only has to hold images.
/// </para>
/// <para>
/// The harness images clone straight into <see cref="WorkspacePath"/>, which therefore has to start
/// out empty and owned by the agent. A fresh volume is neither - its root belongs to root and carries
/// <c>lost+found</c> - so the pod gets the agent's group through <c>fsGroup</c>, an init container
/// running as the agent creates an empty directory on the volume, and the workspace mounts that
/// directory. Nothing in the pod runs as root to do it.
/// </para>
/// </remarks>
public record WorkerScratch(string? StorageClassName = null, string? Size = null)
{
    /// <summary>
    /// The directory the harness images work in - <c>WORKDIR</c> in <c>Dockerfile.base</c>.
    /// </summary>
    public const string WorkspacePath = "/workspace";

    /// <summary>
    /// The name of the scratch volume on the pod.
    /// </summary>
    public const string VolumeName = "workspace-scratch";

    /// <summary>
    /// The name of the init container that prepares the workspace directory.
    /// </summary>
    public const string InitContainerName = "prepare-workspace";

    const string WorkspaceDirectory = "workspace";
    const string PreparationMountPath = "/scratch";

    /// <summary>
    /// No scratch volume - the workspace stays in the container layer.
    /// </summary>
    public static readonly WorkerScratch None = new();

    /// <summary>
    /// Gets whether a scratch volume is configured. Both the class and the size are needed.
    /// </summary>
    public bool IsSet => !string.IsNullOrWhiteSpace(StorageClassName) && !string.IsNullOrWhiteSpace(Size);

    /// <summary>
    /// Builds the per-pod volume, provisioned with the pod and deleted with it.
    /// </summary>
    /// <returns>The volume.</returns>
    public V1Volume ToVolume() => new()
    {
        Name = VolumeName,
        Ephemeral = new V1EphemeralVolumeSource
        {
            VolumeClaimTemplate = new V1PersistentVolumeClaimTemplate
            {
                Spec = new V1PersistentVolumeClaimSpec
                {
                    AccessModes = ["ReadWriteOnce"],
                    StorageClassName = StorageClassName,
                    Resources = new V1VolumeResourceRequirements
                    {
                        Requests = new Dictionary<string, ResourceQuantity> { ["storage"] = new(Size) }
                    }
                }
            }
        }
    };

    /// <summary>
    /// Builds the worker container's mount of the prepared workspace directory.
    /// </summary>
    /// <returns>The mount.</returns>
    public V1VolumeMount ToWorkspaceMount() => new()
    {
        Name = VolumeName,
        MountPath = WorkspacePath,
        SubPath = WorkspaceDirectory
    };

    /// <summary>
    /// Builds the init container that creates the empty workspace directory on the volume.
    /// </summary>
    /// <param name="image">The worker's own image - already pulled for the worker, and carrying a shell.</param>
    /// <returns>The init container.</returns>
    public V1Container ToInitContainer(string image) => new()
    {
        Name = InitContainerName,
        Image = image,
        Command = ["sh", "-c", $"mkdir -p {PreparationMountPath}/{WorkspaceDirectory}"],
        VolumeMounts = [new V1VolumeMount { Name = VolumeName, MountPath = PreparationMountPath }],
        SecurityContext = new V1SecurityContext
        {
            AllowPrivilegeEscalation = false,
            Capabilities = new V1Capabilities { Drop = ["ALL"] }
        }
    };
}
