// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.PullRequests.Closing;
using Planner.PullRequests.Registration;
using Planner.PullRequests.Reopening;

namespace Planner.PullRequests.Listing.for_PullRequest.when_projecting;

public class and_pull_request_moves_through_its_lifecycle : Specification
{
    static readonly PullRequestId _pullRequestId = PullRequestId.From("Cratis", "Studio", 42);

    ReadModelScenario<PullRequest> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_pullRequestId)
            .Events(
                new PullRequestRegistered("Cratis", "Studio", 42, "Fix the thing", "someuser", DateTimeOffset.UnixEpoch, "https://github.com/Cratis/Studio/pull/42", true),
                new PullRequestClosed(true));

    [Fact] void should_hold_the_title() => _scenario.Instance.Title.ShouldEqual(new PullRequestTitle("Fix the thing"));
    [Fact] void should_no_longer_be_open() => Assert.False(_scenario.Instance!.IsOpen);
    [Fact] void should_be_merged() => Assert.True(_scenario.Instance!.Merged);
}
#endif
