// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts;
using Planner.Issues;
using Planner.Issues.ChangingStatus;
using Planner.Work.Listing;
using Planner.Work.Starting;

namespace Planner.Work.PropagatingStatus.for_WorkStatusPropagation;

public class when_work_starts : given.a_work_item
{
    void Establish() => SetWorkItem(new WorkItem(
        _workId,
        WorkPurpose.Implementation,
        [new IssueId("cratis-studio-1"), new IssueId("cratis-studio-2")],
        ModelName.NotSet));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(new WorkStarted(AccountId.New(), "sonnet"));

    [Fact]
    async Task should_put_the_first_issue_in_progress() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ChangeIssueStatus>(command =>
            command.Issue == new IssueId("cratis-studio-1") && command.Status == IssueStatus.InProgress));

    [Fact]
    async Task should_put_the_second_issue_in_progress() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ChangeIssueStatus>(command =>
            command.Issue == new IssueId("cratis-studio-2") && command.Status == IssueStatus.InProgress));
}
#endif
