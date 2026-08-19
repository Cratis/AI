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
    const string SecretVolumeName = "planner-secrets";

    static Dictionary<string, string> ManagedByPlanner => new() { ["app.kubernetes.io/managed-by"] = "cratis-planner" };

    /// <summary>
    /// Builds the Job specification for a worker - the object that ends up in
    /// <c>kubectl get job -o yaml</c>, and therefore the one that must carry no credential.
    /// </summary>
    /// <param name="job">The worker job to describe.</param>
    /// <returns>The Job specification.</returns>
    public static V1Job BuildJobSpecification(WorkerJob job)
    {
        var name = JobNameFor(job.Work);
        return new V1Job
        {
            Metadata = new V1ObjectMeta
            {
                Name = name,
                Labels = ManagedByPlanner
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
                        Volumes =
                        [
                            new V1Volume
                            {
                                Name = SecretVolumeName,

                                // 0400 through the mount: the file is delivered readable only by the
                                // container's user, without the entrypoint having to fix it up.
                                Secret = new V1SecretVolumeSource { SecretName = name, DefaultMode = 256 }
                            }
                        ],
                        Containers =
                        [
                            new V1Container
                            {
                                Name = "worker",
                                Image = job.Image,

                                // Only non-secret configuration goes on the specification. The
                                // credentials arrive through the mount below, so `kubectl get job
                                // -o yaml` shows a volume reference rather than a token.
                                Env =
                                [
                                    .. job.EnvironmentVariables.Select(variable => new V1EnvVar { Name = variable.Key, Value = variable.Value }),
                                    new V1EnvVar { Name = WorkerSecrets.PathVariableName, Value = WorkerSecrets.Path }
                                ],
                                VolumeMounts =
                                [
                                    new V1VolumeMount
                                    {
                                        Name = SecretVolumeName,
                                        MountPath = WorkerSecrets.Directory,
                                        ReadOnlyProperty = true
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };
    }

    /// <inheritdoc/>
    public async Task Start(WorkerJob job, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();

        var name = JobNameFor(job.Work);

        // The secret is created before the job so the pod never starts against a missing mount, and
        // it is adopted by the job afterwards so Kubernetes garbage-collects it with the job rather
        // than leaving the credentials behind.
        var secret = await client.CoreV1.CreateNamespacedSecretAsync(
            new V1Secret
            {
                Metadata = new V1ObjectMeta
                {
                    Name = name,
                    Labels = ManagedByPlanner
                },
                Type = "Opaque",
                StringData = new Dictionary<string, string> { [WorkerSecrets.FileName] = WorkerSecrets.Render(job.Secrets) }
            },
            options.Value.KubernetesNamespace,
            cancellationToken: cancellationToken);

        var kubernetesJob = BuildJobSpecification(job);

        try
        {
            var created = await client.BatchV1.CreateNamespacedJobAsync(kubernetesJob, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
            await AdoptSecret(client, secret, created, cancellationToken);
        }
        catch (Exception)
        {
            // Nothing owns the secret yet, so a failed job creation would strand it with the
            // credentials in it.
            await DeleteSecret(client, name, cancellationToken);
            throw;
        }

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

        // Owner references clean this up with the job, but only when the job was actually adopted -
        // deleting it here too means a stop always takes the credentials with it.
        await DeleteSecret(client, JobNameFor(work), cancellationToken);
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

    async Task AdoptSecret(Kubernetes client, V1Secret secret, V1Job job, CancellationToken cancellationToken)
    {
        secret.Metadata.OwnerReferences =
        [
            new V1OwnerReference
            {
                ApiVersion = "batch/v1",
                Kind = "Job",
                Name = job.Metadata.Name,
                Uid = job.Metadata.Uid,
                BlockOwnerDeletion = true
            }
        ];

        await client.CoreV1.ReplaceNamespacedSecretAsync(
            secret,
            secret.Metadata.Name,
            options.Value.KubernetesNamespace,
            cancellationToken: cancellationToken);
    }

    async Task DeleteSecret(Kubernetes client, string name, CancellationToken cancellationToken)
    {
        try
        {
            await client.CoreV1.DeleteNamespacedSecretAsync(name, options.Value.KubernetesNamespace, cancellationToken: cancellationToken);
        }
        catch (Exception exception)
        {
            // Already gone, or garbage-collected with the job - either way the credentials are not
            // left behind, which is the only thing this guarantees.
            logger.CouldNotDeleteWorkerSecret(exception, name);
        }
    }

    Kubernetes CreateClient()
    {
        var configuration = KubernetesClientConfiguration.IsInCluster()
            ? KubernetesClientConfiguration.InClusterConfig()
            : KubernetesClientConfiguration.BuildConfigFromConfigFile();
        return new Kubernetes(configuration);
    }
}
