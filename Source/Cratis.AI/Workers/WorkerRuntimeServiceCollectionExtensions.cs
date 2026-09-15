// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Workers;

/// <summary>
/// Extension methods for registering the worker runtime. Ported from Direct's
/// <c>Work.Workers.WorkerRuntimeServiceCollectionExtensions</c> (plan Section 5.6).
/// </summary>
public static class WorkerRuntimeServiceCollectionExtensions
{
    /// <summary>
    /// Adds the <see cref="IWorkerRuntime"/> bound to the environment the consumer runs in -
    /// Kubernetes when running in a cluster, otherwise the local Docker daemon - overridable
    /// through the <see cref="WorkerRuntimeOptions.SectionName"/> configuration section. Which
    /// CLI/harness a worker container runs is the acting agent's own configuration, resolved by the
    /// consumer before a <see cref="WorkerJob"/> is ever built - not a concern here.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add to.</param>
    /// <param name="configuration">The configuration to bind the options from.</param>
    /// <returns>The same <see cref="IServiceCollection"/> for chaining.</returns>
    public static IServiceCollection AddWorkerRuntime(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<WorkerRuntimeOptions>(configuration.GetSection(WorkerRuntimeOptions.SectionName));
        services.AddSingleton<IWorkerRuntime>(serviceProvider =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<WorkerRuntimeOptions>>();
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
