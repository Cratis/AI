// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Failing;

/// <summary>
/// Command for recording that a unit of work failed - executed when the worker container reports
/// a failure or terminates unexpectedly.
/// </summary>
/// <param name="Work">The identity of the work.</param>
/// <param name="Reason">The reason the work failed.</param>
[Command]
public record FailWork(WorkId Work, FailureReason Reason)
{
    /// <summary>
    /// Handles the command by appending a <see cref="WorkFailed"/> event to the work's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public WorkFailed Handle() => new(Reason);
}

/// <summary>
/// Event raised when a unit of work failed - the covered issues fall back to no status so a human
/// can decide whether to mark them ready again.
/// </summary>
/// <param name="Reason">The reason the work failed.</param>
[EventType]
public record WorkFailed(FailureReason Reason);
