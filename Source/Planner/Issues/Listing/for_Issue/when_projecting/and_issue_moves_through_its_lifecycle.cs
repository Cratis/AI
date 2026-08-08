// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.AssociatingPullRequest;
using Planner.Issues.ChangingStatus;
using Planner.Issues.RecordingInvestigation;
using Planner.Issues.Registration;
using Planner.Issues.Renaming;

namespace Planner.Issues.Listing.for_Issue.when_projecting;

public class and_issue_moves_through_its_lifecycle : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 256);

    ReadModelScenario<Issue> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(
                new IssueRegistered("Cratis", "Studio", 256, "Fix the thing", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.External, true),
                new IssueRenamed("Fix the thing properly"),
                new IssueInvestigated("Implement by adding a slice", "sonnet"),
                new IssueMarkedReadyForDevelopment(),
                new IssueDevelopmentStarted(),
                new PullRequestAssociated(42, "https://github.com/Cratis/Studio/pull/42", "Cratis", "Studio"),
                new IssueMarkedForReview());

    [Fact] void should_hold_the_new_title() => _scenario.Instance.Title.ShouldEqual(new IssueTitle("Fix the thing properly"));
    [Fact] void should_be_for_review() => _scenario.Instance.Status.ShouldEqual(IssueStatus.ForReview);
    [Fact] void should_hold_the_pull_request() => _scenario.Instance.PullRequest.ShouldEqual(new PullRequestNumber(42));
    [Fact] void should_hold_the_pull_request_repository() => _scenario.Instance.PullRequestRepository.ShouldEqual(new RepositoryName("Studio"));
    [Fact] void should_hold_the_investigation() => _scenario.Instance.Investigation.ShouldEqual(new InvestigationSummary("Implement by adding a slice"));
    [Fact] void should_hold_the_suggested_model() => _scenario.Instance.SuggestedModel.ShouldEqual(new ModelName("sonnet"));
}
#endif
