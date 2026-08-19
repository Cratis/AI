// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts;
using Planner.Issues;
using Planner.Work.Listing;
using Planner.Work.Starting;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.AssigningAIIdentity.for_AIIdentityAssignment.when_work_starts;

public class and_no_ai_login_is_configured : given.a_reactor
{
    void Establish()
    {
        SetWorkItem(new WorkItem(_workId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet));
        SetIssue(new ListedIssue(
            "cratis-studio-1", "Cratis", "Studio", 1, "An issue", "Bug", "someuser", DateTimeOffset.UtcNow, AuthorAssociation.Member, true, IssueStatus.InProgress));
    }

    async Task Because() => await _scenario.Given.ForEventSource(_workId).Events(new WorkStarted(AccountId.New(), "sonnet"));

    [Fact]
    async Task should_not_assign_anything() =>
        await _gitHub.DidNotReceive().AssignIssue(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<IssueNumber>(), Arg.Any<UserName>(), Arg.Any<CancellationToken>());
}
#endif
