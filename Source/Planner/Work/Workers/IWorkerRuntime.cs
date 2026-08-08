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
}
