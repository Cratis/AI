// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.AssociatingPullRequest.when_associating_pull_request;

public class and_information_is_valid : Specification
{
    CommandScenario<AssociatePullRequest> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new AssociatePullRequest("cratis-studioissues-256", 42, "https://github.com/Cratis/Studio/pull/42", "Cratis", "Studio"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_pull_request_associated() => _scenario.EventSequence.ShouldHaveAppendedEvent<PullRequestAssociated>(
        @event =>
            @event.Number == new PullRequestNumber(42) &&
            @event.PullRequestOwner == new OrganizationName("Cratis") &&
            @event.PullRequestRepository == new RepositoryName("Studio"));
}
#endif
