// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;

namespace Planner.Alerts.AutoConvertingToIssue.when_auto_converting_alert_to_issue;

public class and_github_creates_it : Specification
{
    IGitHubClient _gitHub;
    CommandScenario<AutoConvertAlertToIssue> _scenario;
    CommandResult _result;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _gitHub.CreateIssue(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<IssueTitle>(), Arg.Any<IssueBody>(), Arg.Any<CancellationToken>())
            .Returns(new GitHubCreatedIssue(88, "https://github.com/Cratis/Ops/issues/88"));

        _scenario = new();
        _scenario.Services.AddSingleton(_gitHub);
    }

    async Task Because() => _result = await _scenario.Execute(new AutoConvertAlertToIssue(
        "studio-production-pod-loki-0-crashloopbackoff",
        "Cratis",
        "Ops",
        "Alert: Loki keeps crashing",
        "The volume is full."));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_record_the_conversion() => _scenario.EventSequence.ShouldHaveAppendedEvent<Planner.Alerts.ConvertingToIssue.AlertConvertedToIssue>(
        @event => @event.Number == new IssueNumber(88) && @event.Repository == new RepositoryName("Ops"));
}
#endif
