// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using Planner.GitHub;
using Planner.Identity;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Issues.Comments.Replying.when_replying_to_issue;

public class and_the_issue_is_known : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 42);

    IGitHubClient _gitHub;
    ICurrentUser _currentUser;
    CommandScenario<ReplyToIssue> _scenario;
    CommandResult _result;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _currentUser = Substitute.For<ICurrentUser>();
        _currentUser.GetUserName().Returns(new UserName("einari"));

        _scenario = new();
        _scenario.Services.AddSingleton(_gitHub);
        _scenario.Services.AddSingleton(_currentUser);
        _scenario.Given.ForEventSource(_issueId).ReadModel(new ListedIssue(
            _issueId, "Cratis", "Studio", 42, "An issue", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.Member, true, IssueStatus.None));
    }

    async Task Because() => _result = await _scenario.Execute(new ReplyToIssue(_issueId, "Thanks, looking into it"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_post_the_comment_to_github() =>
        await _gitHub.Received(1).AddIssueComment(
            new OrganizationName("Cratis"),
            new RepositoryName("Studio"),
            new IssueNumber(42),
            Arg.Is<string>(body => body.Contains("Thanks, looking into it", StringComparison.Ordinal) && body.Contains("einari", StringComparison.Ordinal)),
            Arg.Any<CancellationToken>());
}
#endif
