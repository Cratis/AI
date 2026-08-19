// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.ChangingStatus;
using Planner.Issues.RecordingInvestigation;
using Planner.Issues.Registration;

namespace Planner.Issues.Listing.for_Issue.when_projecting;

/// <summary>
/// The shape an auto-investigated issue ends up in: an agent picked it up, produced a plan, and
/// handed it back. It must read as waiting for a human - findings and suggested model attached,
/// status back to none - and never as still in progress, which is where the scheduler can never
/// reach it again.
/// </summary>
public class and_an_investigated_issue_is_handed_back : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 512);

    ReadModelScenario<Issue> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(
                new IssueRegistered("Cratis", "Studio", 512, "Something is broken", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.External, true, IssueBody.NotSet, []),
                new IssueDevelopmentStarted(),
                new IssueInvestigated("Split the reducer and project the totals instead", "opus"),
                new IssueStatusCleared());

    [Fact] void should_have_no_status() => _scenario.Instance.Status.ShouldEqual(IssueStatus.None);
    [Fact] void should_keep_the_investigation() => _scenario.Instance.Investigation.ShouldEqual(new InvestigationSummary("Split the reducer and project the totals instead"));
    [Fact] void should_keep_the_suggested_model() => _scenario.Instance.SuggestedModel.ShouldEqual(new ModelName("opus"));
}
#endif
