// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s;
using Microsoft.Extensions.Options;

namespace Planner.Work.Workers;

/// <summary>
/// Extension methods for registering the worker runtime.
/// </summary>
public static class WorkerRuntimeServiceCollectionExtensions
{
    /// <summary>
    /// Adds the <see cref="IWorkerRuntime"/> bound to the environment the Planner runs in -
    /// Kubernetes when running in a cluster, otherwise the local Docker daemon - overridable
    /// through the <c>ContainerRuntime</c> configuration section.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add to.</param>
    /// <param name="configuration">The configuration to bind the options from.</param>
    /// <returns>The same <see cref="IServiceCollection"/> for chaining.</returns>
    public static IServiceCollection AddWorkerRuntime(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ContainerRuntimeOptions>(configuration.GetSection(ContainerRuntimeOptions.SectionName));
        services.AddSingleton<IWorkerRuntime>(serviceProvider =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<ContainerRuntimeOptions>>();
            var type = options.Value.Type;
            if (type == ContainerRuntimeType.Auto)
            {
                type = KubernetesClientConfiguration.IsInCluster() ? ContainerRuntimeType.Kubernetes : ContainerRuntimeType.Docker;
            }

            return type == ContainerRuntimeType.Kubernetes
                ? new KubernetesWorkerRuntime(options, serviceProvider.GetRequiredService<ILogger<KubernetesWorkerRuntime>>())
                : new DockerWorkerRuntime(options, serviceProvider.GetRequiredService<ILogger<DockerWorkerRuntime>>());
        });

        return services;
    }
}
