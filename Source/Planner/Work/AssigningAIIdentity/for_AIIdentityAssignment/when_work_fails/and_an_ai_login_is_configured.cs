// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues;
using Planner.Work.Failing;
using Planner.Work.Listing;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.AssigningAIIdentity.for_AIIdentityAssignment.when_work_fails;

public class and_an_ai_login_is_configured : given.a_reactor
{
    void Establish()
    {
        _options.AIUserLogin = "stagehand-ai";
        SetWorkItem(new WorkItem(_workId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet));
        SetIssue(new ListedIssue(
            "cratis-studio-1", "Cratis", "Studio", 1, "An issue", "Bug", "someuser", DateTimeOffset.UtcNow, AuthorAssociation.Member, true, IssueStatus.None));
    }

    async Task Because() => await _scenario.Given.ForEventSource(_workId).Events(new WorkFailed("It broke"));

    [Fact]
    async Task should_unassign_the_issue_from_the_ai_identity() =>
        await _gitHub.Received(1).UnassignIssue(new OrganizationName("Cratis"), new RepositoryName("Studio"), new IssueNumber(1), new UserName("stagehand-ai"), Arg.Any<CancellationToken>());
}
#endif
