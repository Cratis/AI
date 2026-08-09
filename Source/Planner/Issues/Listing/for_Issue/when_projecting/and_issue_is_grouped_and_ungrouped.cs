// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Grouping;
using Planner.Issues.Grouping.Creating;
using Planner.Issues.Grouping.RemovingIssue;
using Planner.Issues.Registration;
using Planner.Issues.Reordering;

namespace Planner.Issues.Listing.for_Issue.when_projecting;

public class and_issue_is_grouped_and_ungrouped : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 256);
    static readonly GroupId _groupId = GroupId.New();

    ReadModelScenario<Issue> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(
                new IssueRegistered("Cratis", "Studio", 256, "Fix the thing", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.Member, true, IssueBody.NotSet, []),
                new IssueReordered(3.5),
                new IssueAddedToGroup(_groupId),
                new IssueRemovedFromGroup());

    [Fact] void should_hold_the_sort_order() => _scenario.Instance.Order.ShouldEqual(new SortOrder(3.5));
    [Fact] void should_not_be_grouped_anymore() => (_scenario.Instance.Group is null || _scenario.Instance.Group == GroupId.NotSet).ShouldBeTrue();
}
#endif
