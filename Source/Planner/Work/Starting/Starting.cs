// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Accounts;

namespace Planner.Work.Starting;

/// <summary>
/// Command for recording that a unit of work has been dispatched to a worker - executed by the
/// scheduler after it launched the container.
/// </summary>
/// <param name="Work">The identity of the work.</param>
/// <param name="Account">The Claude account the work runs on.</param>
/// <param name="Model">The model the work runs with.</param>
[Command]
public record StartWork(WorkId Work, AccountId Account, ModelName Model)
{
    /// <summary>
    /// Handles the command by appending a <see cref="WorkStarted"/> event to the work's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public WorkStarted Handle() => new(Account, Model);
}

/// <summary>
/// Event raised when a unit of work has started running on a worker - it counts against the
/// account's usage boundaries from this moment.
/// </summary>
/// <param name="Account">The Claude account the work runs on.</param>
/// <param name="Model">The model the work runs with.</param>
[EventType]
public record WorkStarted(AccountId Account, ModelName Model);
