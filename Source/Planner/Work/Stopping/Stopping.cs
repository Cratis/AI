// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Work.Listing;
using Planner.Work.Workers;

namespace Planner.Work.Stopping;

/// <summary>
/// Command for stopping a unit of work - kills the worker container when one is running and takes
/// scheduled work out of the queue.
/// </summary>
/// <param name="Work">The identity of the work to stop.</param>
[Command]
public record StopWork(WorkId Work)
{
    /// <summary>
    /// Handles the command by stopping the worker when the work is running and appending a
    /// <see cref="WorkStopped"/> event. Work that already finished is a validation rejection.
    /// </summary>
    /// <param name="work">The work's read model - resolved by the command's event source id.</param>
    /// <param name="workerRuntime">The <see cref="IWorkerRuntime"/> to stop the worker through.</param>
    /// <returns>The <see cref="WorkStopped"/> event, or a validation error.</returns>
    public async Task<Result<WorkStopped, ValidationResult>> Handle(WorkItem? work, IWorkerRuntime workerRuntime)
    {
        if (work is null)
        {
            return ValidationResult.Error("The work is not known");
        }

        if (work.Status is not (WorkStatus.Scheduled or WorkStatus.Running))
        {
            return ValidationResult.Error("The work has already finished");
        }

        if (work.Status == WorkStatus.Running)
        {
            await workerRuntime.Stop(Work);
        }

        return new WorkStopped();
    }
}

/// <summary>
/// Event raised when a unit of work has been stopped deliberately - the covered issues fall back
/// to no status so a human decides what happens next.
/// </summary>
[EventType]
public record WorkStopped;
