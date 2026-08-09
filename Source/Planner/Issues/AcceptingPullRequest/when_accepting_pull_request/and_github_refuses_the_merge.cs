// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Issues.AcceptingPullRequest.when_accepting_pull_request;

public class and_github_refuses_the_merge : Specification
{
    static readonly IssueId _issueId = new("cratis-studio-256");

    IGitHubClient _gitHub;
    CommandScenario<AcceptPullRequest> _scenario;
    CommandResult _result;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _gitHub.MergePullRequest(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<PullRequestNumber>(), Arg.Any<CancellationToken>())
            .Returns(false);

        _scenario = new();
        _scenario.Services.AddSingleton(_gitHub);
        _scenario.Given.ForEventSource(_issueId).ReadModel(new ListedIssue(
            _issueId,
            "Cratis",
            "Studio",
            256,
            "Fix the thing",
            "Bug",
            "someuser",
            DateTimeOffset.UnixEpoch,
            AuthorAssociation.Member,
            true,
            IssueStatus.ForReview,
            PullRequest: 42,
            PullRequestUrl: "https://github.com/Cratis/Studio/pull/42",
            PullRequestOwner: "Cratis",
            PullRequestRepository: "Studio"));
    }

    async Task Because() => _result = await _scenario.Execute(new AcceptPullRequest(_issueId));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
#endif
