// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Runtime.CompilerServices;
using k8s;
using k8s.Autorest;
using k8s.Models;

namespace Cratis.AI.Workers;

/// <summary>
/// Follows a worker's full console, including when capture begins before Kubernetes creates its Pod.
/// </summary>
internal static class KubernetesWorkerLogs
{
    /// <summary>
    /// Waits for a readable worker container and follows its console until EOF or cancellation.
    /// </summary>
    /// <param name="client">The Kubernetes client for this read.</param>
    /// <param name="namespaceName">The worker namespace.</param>
    /// <param name="jobName">The Job whose Pod owns the console.</param>
    /// <param name="cancellationToken">Cancels both readiness waiting and streaming.</param>
    /// <returns>The complete console lines available from this container.</returns>
    internal static async IAsyncEnumerable<string> Read(
        IKubernetes client,
        string namespaceName,
        string jobName,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var pod = await WaitForPod(client, namespaceName, jobName, cancellationToken);
        if (pod is null)
        {
            yield break;
        }

        await using var stream = await client.CoreV1.ReadNamespacedPodLogAsync(
            pod.Metadata.Name, namespaceName, container: "worker", follow: true, cancellationToken: cancellationToken);
        using var reader = new StreamReader(stream);
        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            yield return line;
        }
    }

    static async Task<V1Pod?> WaitForPod(IKubernetes client, string namespaceName, string jobName, CancellationToken cancellationToken)
    {
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var pods = await client.CoreV1.ListNamespacedPodAsync(namespaceName, labelSelector: $"job-name={jobName}", cancellationToken: cancellationToken);
            var pod = pods.Items.OrderByDescending(candidate => candidate.Metadata.CreationTimestamp).FirstOrDefault();
            if (pod?.Status?.ContainerStatuses?.Any(container => container.Name == "worker" &&
                (container.State?.Running is not null || container.State?.Terminated is not null)) == true)
            {
                return pod;
            }

            var job = await ReadJob(client, namespaceName, jobName, cancellationToken);
            if (job is null || job.Status?.Conditions?.Any(condition =>
                condition.Status == "True" && (condition.Type == "Complete" || condition.Type == "Failed")) == true)
            {
                return null;
            }

            // Infrastructure readiness backoff: a created Job does not imply a Pod or a started container.
            await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);
        }
    }

    static async Task<V1Job?> ReadJob(IKubernetes client, string namespaceName, string jobName, CancellationToken cancellationToken)
    {
        try
        {
            return await client.BatchV1.ReadNamespacedJobAsync(jobName, namespaceName, cancellationToken: cancellationToken);
        }
        catch (HttpOperationException exception) when (exception.Response?.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
