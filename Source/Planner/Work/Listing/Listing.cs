// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Accounts;
using Planner.Issues;
using Planner.Work.Completing;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Failing;
using Planner.Work.Scheduling;
using Planner.Work.Starting;

namespace Planner.Work.Listing;

/// <summary>
/// Read model for the units of agent work - scheduled, running and finished.
/// </summary>
/// <param name="Id">The work identity.</param>
/// <param name="Purpose">What the work is for.</param>
/// <param name="Issues">The identities of the issues the work covers.</param>
/// <param name="Model">The model the work was scheduled with - <see cref="ModelName.NotSet"/> when the scheduler decides.</param>
/// <param name="Status">The lifecycle status.</param>
/// <param name="Account">The Claude account the work runs on - <see langword="null"/> until dispatched.</param>
/// <param name="StartedAt">When the work started running - <see langword="null"/> until dispatched.</param>
/// <param name="Summary">The summary the worker reported - <see langword="null"/> until completed.</param>
/// <param name="Findings">The investigation findings - <see langword="null"/> unless investigation work completed.</param>
/// <param name="Reason">The failure reason - <see langword="null"/> unless the work failed.</param>
[ReadModel]
[FromEvent<WorkScheduled>]
public record WorkItem(
    WorkId Id,
    WorkPurpose Purpose,
    IEnumerable<IssueId> Issues,
    ModelName Model,
    [SetValue<WorkStarted>(WorkStatus.Running)]
    [SetValue<WorkCompleted>(WorkStatus.Completed)]
    [SetValue<InvestigationCompleted>(WorkStatus.Completed)]
    [SetValue<WorkFailed>(WorkStatus.Failed)]
    WorkStatus Status = WorkStatus.Scheduled,
    [SetFrom<WorkStarted>(nameof(WorkStarted.Account))]
    AccountId? Account = null,
    [SetFromContext<WorkStarted>(nameof(EventContext.Occurred))]
    DateTimeOffset? StartedAt = null,
    [SetFrom<WorkCompleted>(nameof(WorkCompleted.Summary))]
    WorkSummary? Summary = null,
    [SetFrom<InvestigationCompleted>(nameof(InvestigationCompleted.Findings))]
    InvestigationSummary? Findings = null,
    [SetFrom<WorkFailed>(nameof(WorkFailed.Reason))]
    FailureReason? Reason = null)
{
    /// <summary>
    /// Observes all units of work.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the work items.</param>
    /// <returns>An observable of all work.</returns>
    public static ISubject<IEnumerable<WorkItem>> AllWork(IMongoCollection<WorkItem> collection) =>
        collection.Observe();
}
