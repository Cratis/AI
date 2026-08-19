// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.AcceptingPullRequest;
using Planner.Issues.AssociatingPullRequest;
using Planner.LanguageModels;
using Planner.Repositories;
using ListedRepository = Planner.Repositories.Listing.Repository;

namespace Planner.Issues.ClassifyingForAutoMerge.for_AutoMergeClassification.when_pull_request_is_associated;

public class and_policy_is_auto_and_it_is_judged_risky : given.a_reactor
{
    void Establish()
    {
        SetRepository(new ListedRepository(
            RepositoryId.From("Cratis", "Studio"), "Cratis", "Studio", null, null, Repositories.IssueSynchronizationStatus.Synchronized, string.Empty, ReviewGatePolicy.Auto));
        SetIssue(new Listing.Issue(
            _issueId, "Cratis", "Studio", 256, "Rework the storage engine", "Feature", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.Member, true, IssueStatus.ForReview));
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(LanguageModelResult.Success(
            """
            { "verdict": "needs-human", "reason": "Touches core behavior" }
            """));
    }

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(new PullRequestAssociated(42, "https://github.com/Cratis/Studio/pull/42", "Cratis", "Studio"));

    [Fact]
    async Task should_not_accept_the_pull_request() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<AcceptPullRequest>());
}
#endif
