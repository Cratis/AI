// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Accounts;
using Planner.Alerts;
using Planner.Issues;
using Planner.Work.Completing;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Failing;
using Planner.Work.Scheduling;
using Planner.Work.SchedulingAdHoc;
using Planner.Work.SchedulingAlertInvestigation;
using Planner.Work.Starting;
using Planner.Work.Stopping;

namespace Planner.Work.Listing;

/// <summary>
/// Read model for the units of agent work - scheduled, running and finished.
/// </summary>
/// <param name="Id">The work identity.</param>
/// <param name="Purpose">What the work is for.</param>
/// <param name="Issues">The identities of the issues the work covers.</param>
/// <param name="Model">The model the work was scheduled with - <see cref="ModelName.NotSet"/> when the scheduler decides.</param>
/// <param name="RequestedBy">The login of the user that scheduled the work - <see cref="UserName.NotSet"/> for automation.</param>
/// <param name="Status">The lifecycle status.</param>
/// <param name="Account">The Claude account the work runs on - <see langword="null"/> until dispatched.</param>
/// <param name="StartedAt">When the work started running - <see langword="null"/> until dispatched.</param>
/// <param name="Summary">The summary the worker reported - <see langword="null"/> until completed.</param>
/// <param name="Findings">The investigation findings - <see langword="null"/> unless investigation work completed.</param>
/// <param name="Reason">The failure reason - <see langword="null"/> unless the work failed.</param>
/// <param name="InputTokens">The input tokens the session consumed - <see langword="null"/> until reported.</param>
/// <param name="OutputTokens">The output tokens the session produced - <see langword="null"/> until reported.</param>
/// <param name="Cost">The cost of the session in USD - <see langword="null"/> until reported.</param>
/// <param name="DurationMs">How long the session ran, in milliseconds - <see langword="null"/> until reported.</param>
/// <param name="Repositories">The repositories ad-hoc work covers - <see langword="null"/> for issue work.</param>
/// <param name="Prompt">The free-form prompt of ad-hoc work - <see langword="null"/> for issue work.</param>
/// <param name="Alert">The alert the work investigates - <see langword="null"/> for every other purpose.</param>
[ReadModel]
[FromEvent<WorkScheduled>]
[FromEvent<AdHocWorkScheduled>]
[FromEvent<AlertInvestigationScheduled>]
public record WorkItem(
    WorkId Id,
    [SetValue<AdHocWorkScheduled>(WorkPurpose.AdHoc)]
    [SetValue<AlertInvestigationScheduled>(WorkPurpose.AlertInvestigation)]
    WorkPurpose Purpose,
    IEnumerable<IssueId> Issues,
    ModelName Model,
    UserName RequestedBy,
    [SetValue<WorkStarted>(WorkStatus.Running)]
    [SetValue<WorkCompleted>(WorkStatus.Completed)]
    [SetValue<InvestigationCompleted>(WorkStatus.Completed)]
    [SetValue<WorkFailed>(WorkStatus.Failed)]
    [SetValue<WorkStopped>(WorkStatus.Stopped)]
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
    FailureReason? Reason = null,
    [SetFrom<WorkCompleted>(nameof(WorkCompleted.InputTokens))]
    [SetFrom<InvestigationCompleted>(nameof(InvestigationCompleted.InputTokens))]
    TokenCount? InputTokens = null,
    [SetFrom<WorkCompleted>(nameof(WorkCompleted.OutputTokens))]
    [SetFrom<InvestigationCompleted>(nameof(InvestigationCompleted.OutputTokens))]
    TokenCount? OutputTokens = null,
    [SetFrom<WorkCompleted>(nameof(WorkCompleted.Cost))]
    [SetFrom<InvestigationCompleted>(nameof(InvestigationCompleted.Cost))]
    UsageCost? Cost = null,
    [SetFrom<WorkCompleted>(nameof(WorkCompleted.DurationMs))]
    [SetFrom<InvestigationCompleted>(nameof(InvestigationCompleted.DurationMs))]
    long? DurationMs = null,
    IEnumerable<RepositoryId>? Repositories = null,
    WorkPrompt? Prompt = null,
    AlertId? Alert = null)
{
    /// <summary>
    /// Observes all units of work.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the work items.</param>
    /// <returns>An observable of all work.</returns>
    public static ISubject<IEnumerable<WorkItem>> AllWork(IMongoCollection<WorkItem> collection) =>
        collection.Observe();
}
