// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s;

namespace Cratis.AI.Workers;

/// <summary>
/// Builds the Kubernetes client the worker runtime talks to the cluster through. Ported from
/// Direct's <c>Containers.IKubernetesClientFactory</c> (plan Section 5.6).
/// </summary>
public interface IKubernetesClientFactory
{
    /// <summary>
    /// Creates a client - in-cluster configuration when running in a cluster, otherwise whatever
    /// <c>kubeconfig</c> the environment points at. The caller owns it and disposes it.
    /// </summary>
    /// <returns>The client.</returns>
    IKubernetes Create();
}

/// <summary>
/// The default <see cref="IKubernetesClientFactory"/>.
/// </summary>
public class KubernetesClientFactory : IKubernetesClientFactory
{
    /// <inheritdoc/>
    public IKubernetes Create()
    {
        var configuration = KubernetesClientConfiguration.IsInCluster()
            ? KubernetesClientConfiguration.InClusterConfig()
            : KubernetesClientConfiguration.BuildConfigFromConfigFile();
        return new Kubernetes(configuration);
    }
}
