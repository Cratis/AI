// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.ChangingAssignees;
using Planner.Issues.Registration;

namespace Planner.Issues.Listing.for_Issue.when_projecting;

public class and_issue_is_assigned_and_unassigned : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 256);

    ReadModelScenario<Issue> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(
                new IssueRegistered("Cratis", "Studio", 256, "Fix the thing", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.External, true, IssueBody.NotSet, []),
                new IssueAssigneesChanged([new UserName("octocat"), new UserName("hubot")]),
                new IssueAssigneesChanged([new UserName("octocat")]));

    [Fact] void should_hold_exactly_one_assignee() => _scenario.Instance.Assignees!.Count().ShouldEqual(1);
    [Fact] void should_hold_the_remaining_assignee() => _scenario.Instance.Assignees!.Single().ShouldEqual(new UserName("octocat"));
}
#endif
