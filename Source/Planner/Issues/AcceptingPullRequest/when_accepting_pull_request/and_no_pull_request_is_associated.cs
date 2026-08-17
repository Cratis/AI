// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;
using Planner.Identity;

namespace Planner.Issues.AcceptingPullRequest.when_accepting_pull_request;

public class and_no_pull_request_is_associated : Specification
{
    static readonly IssueId _issueId = new("cratis-studio-256");

    IGitHubClient _gitHub;
    CommandScenario<AcceptPullRequest> _scenario;
    CommandResult _result;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _scenario = new();
        _scenario.Services.AddSingleton(_gitHub);
    }

    async Task Because()
    {
        // The command requires an authenticated operator; a spec has no HTTP request, so it runs
        // as a trusted system actor - the same scope the production automation uses.
        using var scope = SystemExecutionScope.Enter();
        _result = await _scenario.Execute(new AcceptPullRequest(_issueId));
    }

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();

    [Fact]
    async Task should_not_talk_to_github() =>
        await _gitHub.DidNotReceive().MergePullRequest(
            Arg.Any<OrganizationName>(),
            Arg.Any<RepositoryName>(),
            Arg.Any<PullRequestNumber>(),
            Arg.Any<CancellationToken>());
}
#endif
