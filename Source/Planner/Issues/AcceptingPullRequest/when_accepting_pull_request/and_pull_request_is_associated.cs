// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;
using Planner.Identity;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Issues.AcceptingPullRequest.when_accepting_pull_request;

public class and_pull_request_is_associated : Specification
{
    static readonly IssueId _issueId = new("cratis-studio-256");

    IGitHubClient _gitHub;
    CommandScenario<AcceptPullRequest> _scenario;
    CommandResult _result;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _gitHub.MergePullRequest(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<PullRequestNumber>(), Arg.Any<CancellationToken>())
            .Returns(true);

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

    async Task Because()
    {
        // The command requires an authenticated operator; a spec has no HTTP request, so it runs
        // as a trusted system actor - the same scope the production automation uses.
        using var scope = SystemExecutionScope.Enter();
        _result = await _scenario.Execute(new AcceptPullRequest(_issueId));
    }

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_merge_the_pull_request_on_github() =>
        await _gitHub.Received(1).MergePullRequest(
            new OrganizationName("Cratis"),
            new RepositoryName("Studio"),
            new PullRequestNumber(42),
            Arg.Any<CancellationToken>());

    [Fact]
    void should_append_pull_request_merged() => _scenario.EventSequence.ShouldHaveAppendedEvent<PullRequestMerged>(
        @event => @event.Number == new PullRequestNumber(42));
}
#endif
