// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Workers;

/// <summary>
/// Represents the kind of container runtime the Planner schedules workers on.
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
    Kubernetes = 2
}

/// <summary>
/// Represents the configuration for the container runtime workers are scheduled on, bound from the
/// <c>ContainerRuntime</c> configuration section.
/// </summary>
public class ContainerRuntimeOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "ContainerRuntime";

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
}
