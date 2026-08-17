// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Planner.Alerts;
using Planner.Identity;

namespace Planner.Work.SchedulingAlertInvestigation;

/// <summary>
/// Command for putting an agent on an alert - it looks at the running system, works out what is
/// wrong, and either fixes it or hands back what it found. The scheduler dispatches it to a worker
/// container as soon as an account with capacity is available, exactly like every other unit of work.
/// </summary>
/// <remarks>
/// Requires an authenticated operator. Automation schedules these too - the alert reactor does so inside
/// an Arc system-execution scope, which is the only path that bypasses the operator requirement.
/// </remarks>
/// <param name="Alert">The identity of the alert to investigate.</param>
/// <param name="Model">The model to use - optional; the scheduler falls back to the configured alert model.</param>
[Command]
[Authorize]
public record ScheduleAlertInvestigation(AlertId Alert, ModelName? Model = null)
{
    /// <summary>
    /// Handles the command by opening a new work stream and appending an
    /// <see cref="AlertInvestigationScheduled"/> event.
    /// </summary>
    /// <param name="currentUser">The <see cref="ICurrentUser"/> scheduling the work, when there is one.</param>
    /// <returns>A tuple of the work identity (event source) and the event.</returns>
    public (WorkId, AlertInvestigationScheduled) Handle(ICurrentUser currentUser) =>
        (WorkId.New(), new(Alert, Model ?? ModelName.NotSet, currentUser.GetUserName()));
}

/// <summary>
/// Event raised when an agent has been put on an alert - it waits until the scheduler finds an
/// account with capacity.
/// </summary>
/// <param name="Alert">The identity of the alert being investigated.</param>
/// <param name="Model">The model to use - <see cref="ModelName.NotSet"/> when the scheduler should decide.</param>
/// <param name="RequestedBy">The login of the user that asked for it - <see cref="UserName.NotSet"/> for automation.</param>
[EventType]
public record AlertInvestigationScheduled(AlertId Alert, ModelName Model, UserName RequestedBy);
