// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Scheduling;

/// <summary>
/// Defines the scheduling pass the Planner runs to turn ready issues into scheduled work and
/// dispatch scheduled work to worker containers within the accounts' capacity.
/// </summary>
public interface IWorkDispatcher
{
    /// <summary>
    /// Runs one scheduling pass: schedules work for issues that are ready for development (a
    /// grouped issue waits until its whole group is ready), then dispatches scheduled work to
    /// accounts with available capacity.
    /// </summary>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task RunSchedulingPass(CancellationToken cancellationToken = default);
}
