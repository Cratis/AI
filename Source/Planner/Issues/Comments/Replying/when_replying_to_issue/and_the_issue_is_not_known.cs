// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using Planner.GitHub;
using Planner.Identity;

namespace Planner.Issues.Comments.Replying.when_replying_to_issue;

public class and_the_issue_is_not_known : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 999);

    IGitHubClient _gitHub;
    CommandScenario<ReplyToIssue> _scenario;
    CommandResult _result;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _scenario = new();
        _scenario.Services.AddSingleton(_gitHub);
        _scenario.Services.AddSingleton(Substitute.For<ICurrentUser>());
    }

    async Task Because() => _result = await _scenario.Execute(new ReplyToIssue(_issueId, "Thanks"));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();

    [Fact]
    async Task should_not_post_anything() =>
        await _gitHub.DidNotReceive().AddIssueComment(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<IssueNumber>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
}
#endif
