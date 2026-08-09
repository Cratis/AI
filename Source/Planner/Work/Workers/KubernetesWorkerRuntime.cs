// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Runtime.CompilerServices;
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
        using var client = CreateClient();

        var name = JobNameFor(job.Work);
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

    /// <inheritdoc/>
    public async Task Stop(WorkId work, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        try
        {
            await client.BatchV1.DeleteNamespacedJobAsync(
                JobNameFor(work),
                options.Value.KubernetesNamespace,
                propagationPolicy: "Foreground",
                cancellationToken: cancellationToken);
            logger.StoppedWorkerContainer(work);
        }
        catch (Exception exception)
        {
            // The job may already be gone - stopping is best effort.
            logger.CouldNotStopWorker(exception, work);
        }
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<string> StreamLogs(WorkId work, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        var pods = await client.CoreV1.ListNamespacedPodAsync(
            options.Value.KubernetesNamespace,
            labelSelector: $"job-name={JobNameFor(work)}",
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
    public async Task SendInput(WorkId work, string text, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        var pods = await client.CoreV1.ListNamespacedPodAsync(
            options.Value.KubernetesNamespace,
            labelSelector: $"job-name={JobNameFor(work)}",
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

    static string JobNameFor(WorkId work) => $"planner-work-{work.Value:N}";

    Kubernetes CreateClient()
    {
        var configuration = KubernetesClientConfiguration.IsInCluster()
            ? KubernetesClientConfiguration.InClusterConfig()
            : KubernetesClientConfiguration.BuildConfigFromConfigFile();
        return new Kubernetes(configuration);
    }
}
