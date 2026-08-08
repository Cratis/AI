// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues;
using Planner.Issues.AssociatingPullRequest;
using Planner.Issues.ChangingStatus;
using Planner.Work.Completing;
using Planner.Work.Listing;

namespace Planner.Work.PropagatingStatus.for_WorkStatusPropagation;

public class when_work_completes_with_a_pull_request : given.a_work_item
{
    void Establish() => SetWorkItem(new WorkItem(
        _workId,
        WorkPurpose.Implementation,
        [new IssueId("cratis-studio-1")],
        ModelName.NotSet,
        UserName.NotSet));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(new WorkCompleted("Implemented the thing", 42, "https://github.com/Cratis/Studio/pull/42", "Cratis", "Studio", TokenCount.NotSet, TokenCount.NotSet, UsageCost.NotSet, 0));

    [Fact]
    async Task should_associate_the_pull_request_with_the_issue() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<AssociatePullRequest>(command =>
            command.Issue == new IssueId("cratis-studio-1") &&
            command.Number == new PullRequestNumber(42) &&
            command.PullRequestRepository == new RepositoryName("Studio")));

    [Fact]
    async Task should_mark_the_issue_for_review() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ChangeIssueStatus>(command =>
            command.Issue == new IssueId("cratis-studio-1") && command.Status == IssueStatus.ForReview));
}
#endif
