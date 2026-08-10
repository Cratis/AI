// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;

namespace Planner.Alerts.ConvertingToIssue.when_converting_an_alert_to_an_issue;

public class and_the_repository_is_not_tracked : Specification
{
    IGitHubClient _gitHub;
    CommandScenario<ConvertAlertToIssue> _scenario;
    CommandResult _result;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _scenario = new();
        _scenario.Services.AddSingleton(_gitHub);
    }

    async Task Because() => _result = await _scenario.Execute(new ConvertAlertToIssue(
        "studio-production-pod-loki-0-crashloopbackoff",
        RepositoryId.From("Cratis", "NeverAdded"),
        "Loki retention never applies",
        "The agent found the retention config is not read at startup."));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();

    [Fact]
    async Task should_not_talk_to_github() => await _gitHub.DidNotReceive().CreateIssue(
        Arg.Any<OrganizationName>(),
        Arg.Any<RepositoryName>(),
        Arg.Any<IssueTitle>(),
        Arg.Any<IssueBody>(),
        Arg.Any<CancellationToken>());
}
#endif
