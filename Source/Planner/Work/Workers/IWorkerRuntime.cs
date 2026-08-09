// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Workers;

/// <summary>
/// Defines the runtime that launches worker containers for scheduled work. Implementations bind to
/// the environment the Planner runs in: the local Docker daemon when running and testing locally,
/// Kubernetes in production - selected through <see cref="ContainerRuntimeOptions"/>.
/// </summary>
public interface IWorkerRuntime
{
    /// <summary>
    /// Launches a worker container for a unit of work. The container runs to completion on its own
    /// and reports progress back through the callback URL in its environment.
    /// </summary>
    /// <param name="job">The worker job to launch.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task Start(WorkerJob job, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stops and removes the worker for a unit of work. Best effort - a worker that already
    /// finished or was cleaned up is not an error.
    /// </summary>
    /// <param name="work">The identity of the work whose worker to stop.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task Stop(WorkId work, CancellationToken cancellationToken = default);

    /// <summary>
    /// Streams the console output of the worker for a unit of work, line by line, following the
    /// log while the worker runs.
    /// </summary>
    /// <param name="work">The identity of the work whose worker log to stream.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> that ends the stream.</param>
    /// <returns>An async stream of log lines.</returns>
    IAsyncEnumerable<string> StreamLogs(WorkId work, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a line of text to the worker's standard input - the entrypoint forwards it to the
    /// running Claude session as a steering message.
    /// </summary>
    /// <param name="work">The identity of the work whose worker to steer.</param>
    /// <param name="text">The text to send.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task SendInput(WorkId work, string text, CancellationToken cancellationToken = default);
}
