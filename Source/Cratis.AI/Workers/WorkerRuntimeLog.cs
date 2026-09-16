// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Workers;

/// <summary>
/// Log messages for the worker runtimes. Ported from Direct's <c>Work.Workers.WorkerRuntimeLog</c>
/// (plan Section 5.6), <c>WorkId</c> generalized to <see cref="AgentSessionId"/>.
/// </summary>
internal static partial class WorkerRuntimeLog
{
    [LoggerMessage(LogLevel.Debug, "Could not pull image '{Image}' - assuming it exists locally")]
    internal static partial void CouldNotPullImage(this ILogger logger, Exception exception, string image);

    [LoggerMessage(LogLevel.Information, "Started worker container '{ContainerId}' for session {Session}")]
    internal static partial void StartedWorkerContainer(this ILogger logger, string containerId, AgentSessionId session);

    [LoggerMessage(LogLevel.Information, "Created Kubernetes job '{JobName}' for session {Session}")]
    internal static partial void CreatedKubernetesJob(this ILogger logger, string jobName, AgentSessionId session);

    [LoggerMessage(LogLevel.Information, "Stopped worker for session {Session}")]
    internal static partial void StoppedWorkerContainer(this ILogger logger, AgentSessionId session);

    [LoggerMessage(LogLevel.Debug, "Could not stop worker for session {Session} - it may already be gone")]
    internal static partial void CouldNotStopWorker(this ILogger logger, Exception exception, AgentSessionId session);

    [LoggerMessage(LogLevel.Debug, "Log stream for session {Session} ended")]
    internal static partial void LogStreamEnded(this ILogger logger, Exception exception, AgentSessionId session);

    [LoggerMessage(LogLevel.Debug, "Could not delete worker secret '{SecretName}' - it may already be gone")]
    internal static partial void CouldNotDeleteWorkerSecret(this ILogger logger, Exception exception, string secretName);

    [LoggerMessage(LogLevel.Warning, "Could not read the worker state for session {Session} - treating it as unknown rather than dead")]
    internal static partial void CouldNotReadWorkerState(this ILogger logger, Exception exception, AgentSessionId session);

    [LoggerMessage(LogLevel.Warning, "Worker job '{JobName}' for session {Session} has been terminating for {TerminatingFor} - removing its leftovers by force so the work can be dispatched again")]
    internal static partial void ReleasingStuckWorkerJob(this ILogger logger, string jobName, AgentSessionId session, TimeSpan terminatingFor);

    [LoggerMessage(LogLevel.Information, "Purged the leftovers of worker '{JobName}' for session {Session}")]
    internal static partial void PurgedWorkerLeftovers(this ILogger logger, string jobName, AgentSessionId session);

    [LoggerMessage(LogLevel.Debug, "Could not remove the pods of worker job '{JobName}' - they may already be gone")]
    internal static partial void CouldNotRemoveWorkerPods(this ILogger logger, Exception exception, string jobName);

    [LoggerMessage(LogLevel.Warning, "Could not clear the finalizers holding worker job '{JobName}' - its name stays taken until they go")]
    internal static partial void CouldNotReleaseWorkerJob(this ILogger logger, Exception exception, string jobName);

    [LoggerMessage(LogLevel.Warning, "The cluster refused to launch a worker for session {Session} - this is about the cluster rather than the work, so it stays scheduled")]
    internal static partial void WorkerLaunchRefusedByCluster(this ILogger logger, Exception exception, AgentSessionId session);
}
