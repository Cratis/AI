// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues;
using Planner.Issues.ChangingStatus;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Listing;

namespace Planner.Work.PropagatingStatus.for_WorkStatusPropagation;

/// <summary>
/// Investigation work reports back with <see cref="InvestigationCompleted"/> rather than
/// <see cref="Completing.WorkCompleted"/>, so an issue put in progress when the investigation
/// started must be handed back to a human here - otherwise it reads as "an agent is working on it"
/// forever and the scheduler, which only picks up ready issues, can never touch it again.
/// </summary>
public class when_an_investigation_completes : given.a_work_item
{
    void Establish() => SetWorkItem(new WorkItem(
        _workId,
        WorkPurpose.Investigation,
        [new IssueId("cratis-studio-1")],
        ModelName.NotSet,
        UserName.NotSet));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(new InvestigationCompleted(
                "Split the reducer and project the totals instead",
                "opus",
                TokenCount.NotSet,
                TokenCount.NotSet,
                UsageCost.NotSet,
                1000));

    [Fact]
    async Task should_clear_the_status_of_the_investigated_issue() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ChangeIssueStatus>(command =>
            command.Issue == new IssueId("cratis-studio-1") && command.Status == IssueStatus.None));

    [Fact]
    async Task should_not_leave_the_issue_in_progress() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Is<ChangeIssueStatus>(command =>
            command.Status == IssueStatus.InProgress));
}
#endif
