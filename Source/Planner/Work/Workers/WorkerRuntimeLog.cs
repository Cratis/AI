// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Workers;

/// <summary>
/// Log messages for the worker runtimes.
/// </summary>
internal static partial class WorkerRuntimeLog
{
    [LoggerMessage(LogLevel.Debug, "Could not pull image '{Image}' - assuming it exists locally")]
    internal static partial void CouldNotPullImage(this ILogger logger, Exception exception, string image);

    [LoggerMessage(LogLevel.Information, "Started worker container '{ContainerId}' for work {WorkId}")]
    internal static partial void StartedWorkerContainer(this ILogger logger, string containerId, WorkId workId);

    [LoggerMessage(LogLevel.Information, "Created Kubernetes job '{JobName}' for work {WorkId}")]
    internal static partial void CreatedKubernetesJob(this ILogger logger, string jobName, WorkId workId);

    [LoggerMessage(LogLevel.Information, "Stopped worker for work {WorkId}")]
    internal static partial void StoppedWorkerContainer(this ILogger logger, WorkId workId);

    [LoggerMessage(LogLevel.Debug, "Could not stop worker for work {WorkId} - it may already be gone")]
    internal static partial void CouldNotStopWorker(this ILogger logger, Exception exception, WorkId workId);

    [LoggerMessage(LogLevel.Debug, "Log stream for work {WorkId} ended")]
    internal static partial void LogStreamEnded(this ILogger logger, Exception exception, WorkId workId);
}
