// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Identity;

namespace Planner.Work.Scheduling;

/// <summary>
/// Command for scheduling a unit of agent work covering one or more issues - either an
/// investigation or an implementation. The scheduler dispatches it to a worker container as soon
/// as an account with capacity is available. Work a user schedules is attributed to them so the
/// dispatch prefers their own Claude account(s); work scheduled by automation goes to the pool.
/// </summary>
/// <param name="Purpose">What the work is for.</param>
/// <param name="Issues">The identities of the issues the work covers.</param>
/// <param name="Model">The model to use - optional; the scheduler falls back to the issue's suggested model or the configured default.</param>
[Command]
public record ScheduleWork(WorkPurpose Purpose, IEnumerable<IssueId> Issues, ModelName? Model = null)
{
    /// <summary>
    /// Handles the command by opening a new work stream and appending a <see cref="WorkScheduled"/> event.
    /// </summary>
    /// <param name="currentUser">The <see cref="ICurrentUser"/> scheduling the work, when there is one.</param>
    /// <returns>A tuple of the work identity (event source) and the event.</returns>
    public (WorkId, WorkScheduled) Handle(ICurrentUser currentUser) =>
        (WorkId.New(), new(Purpose, Issues, Model ?? ModelName.NotSet, currentUser.GetUserName()));
}

/// <summary>
/// Represents the validator for the <see cref="ScheduleWork"/> command.
/// </summary>
public class ScheduleWorkValidator : CommandValidator<ScheduleWork>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ScheduleWorkValidator"/> class.
    /// </summary>
    public ScheduleWorkValidator() => RuleFor(_ => _.Issues).NotEmpty().WithMessage("Work needs at least one issue");
}

/// <summary>
/// Event raised when a unit of agent work has been scheduled - it waits until the scheduler finds
/// an account with capacity.
/// </summary>
/// <param name="Purpose">What the work is for.</param>
/// <param name="Issues">The identities of the issues the work covers.</param>
/// <param name="Model">The model to use - <see cref="ModelName.NotSet"/> when the scheduler should decide.</param>
/// <param name="RequestedBy">The login of the user that scheduled the work - <see cref="UserName.NotSet"/> for automation, which draws from the account pool.</param>
[EventType]
public record WorkScheduled(WorkPurpose Purpose, IEnumerable<IssueId> Issues, ModelName Model, UserName RequestedBy);
