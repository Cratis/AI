// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.AcceptingPullRequest;
using Planner.Issues.AssociatingPullRequest;
using Planner.Repositories;
using ListedRepository = Planner.Repositories.Listing.Repository;

namespace Planner.Issues.ClassifyingForAutoMerge.for_AutoMergeClassification.when_pull_request_is_associated;

public class and_policy_is_human : given.a_reactor
{
    void Establish() => SetRepository(new ListedRepository(
        RepositoryId.From("Cratis", "Studio"), "Cratis", "Studio", null, null, Repositories.IssueSynchronizationStatus.Synchronized, string.Empty, ReviewGatePolicy.Human));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(new PullRequestAssociated(42, "https://github.com/Cratis/Studio/pull/42", "Cratis", "Studio"));

    [Fact]
    async Task should_not_ask_the_language_model() =>
        await _languageModel.DidNotReceive().Complete(Arg.Any<string>(), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_not_accept_the_pull_request() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<AcceptPullRequest>());
}
#endif
