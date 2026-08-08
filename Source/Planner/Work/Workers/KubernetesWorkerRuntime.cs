// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s;
using k8s.Models;
using Microsoft.Extensions.Options;

namespace Planner.Work.Workers;

/// <summary>
/// An <see cref="IWorkerRuntime"/> that launches worker containers as Kubernetes jobs - the
/// runtime used when the Planner runs in a cluster.
/// </summary>
/// <param name="options">The <see cref="ContainerRuntimeOptions"/> configuring the namespace.</param>
/// <param name="logger">The logger.</param>
public class KubernetesWorkerRuntime(IOptions<ContainerRuntimeOptions> options, ILogger<KubernetesWorkerRuntime> logger) : IWorkerRuntime
{
    /// <inheritdoc/>
    public async Task Start(WorkerJob job, CancellationToken cancellationToken = default)
    {
        var configuration = KubernetesClientConfiguration.IsInCluster()
            ? KubernetesClientConfiguration.InClusterConfig()
            : KubernetesClientConfiguration.BuildConfigFromConfigFile();
        using var client = new Kubernetes(configuration);

        var name = $"planner-work-{job.Work.Value:N}";
        var kubernetesJob = new V1Job
        {
            Metadata = new V1ObjectMeta
            {
                Name = name,
                Labels = new Dictionary<string, string> { ["app.kubernetes.io/managed-by"] = "cratis-planner" }
            },
            Spec = new V1JobSpec
            {
                BackoffLimit = 0,
                TtlSecondsAfterFinished = 3600,
                Template = new V1PodTemplateSpec
                {
                    Spec = new V1PodSpec
                    {
                        RestartPolicy = "Never",
                        Containers =
                        [
                            new V1Container
                            {
                                Name = "worker",
                                Image = job.Image,
                                Env = [.. job.EnvironmentVariables.Select(variable => new V1EnvVar { Name = variable.Key, Value = variable.Value })]
                            }
                        ]
                    }
                }
            }
        };

        await client.BatchV1.CreateNamespacedJobAsync(kubernetesJob, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
        logger.CreatedKubernetesJob(name, job.Work);
    }
}
