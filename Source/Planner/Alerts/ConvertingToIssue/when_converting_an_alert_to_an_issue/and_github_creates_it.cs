// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;
using Planner.Repositories;
using TrackedRepository = Planner.Repositories.Listing.Repository;

namespace Planner.Alerts.ConvertingToIssue.when_converting_an_alert_to_an_issue;

public class and_github_creates_it : Specification
{
    static readonly RepositoryId _repositoryId = RepositoryId.From("Cratis", "Studio");

    IGitHubClient _gitHub;
    CommandScenario<ConvertAlertToIssue> _scenario;
    CommandResult _result;

    void Establish()
    {
        _gitHub = Substitute.For<IGitHubClient>();
        _gitHub.CreateIssue(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<IssueTitle>(), Arg.Any<IssueBody>(), Arg.Any<CancellationToken>())
            .Returns(new GitHubCreatedIssue(451, "https://github.com/Cratis/Studio/issues/451"));

        _scenario = new();
        _scenario.Services.AddSingleton(_gitHub);
        _scenario.Given.ForEventSource(_repositoryId).ReadModel(new TrackedRepository(
            _repositoryId,
            "Cratis",
            "Studio",
            null,
            null,
            IssueSynchronizationStatus.Synchronized,
            string.Empty));
    }

    async Task Because() => _result = await _scenario.Execute(new ConvertAlertToIssue(
        "studio-production-pod-loki-0-crashloopbackoff",
        _repositoryId,
        "Loki retention never applies",
        "The agent found the retention config is not read at startup."));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_create_the_issue_on_github() => await _gitHub.Received(1).CreateIssue(
        new OrganizationName("Cratis"),
        new RepositoryName("Studio"),
        new IssueTitle("Loki retention never applies"),
        new IssueBody("The agent found the retention config is not read at startup."),
        Arg.Any<CancellationToken>());

    [Fact]
    void should_record_the_conversion() => _scenario.EventSequence.ShouldHaveAppendedEvent<AlertConvertedToIssue>(
        @event => @event.Number == new IssueNumber(451) && @event.Repository == new RepositoryName("Studio"));
}
#endif
