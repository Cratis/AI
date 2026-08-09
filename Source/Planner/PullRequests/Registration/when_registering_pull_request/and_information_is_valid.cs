// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.PullRequests.Registration.when_registering_pull_request;

public class and_information_is_valid : Specification
{
    CommandScenario<RegisterPullRequest> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new RegisterPullRequest("Cratis", "Studio", 42, "Fix the thing", "someuser", DateTimeOffset.UnixEpoch, "https://github.com/Cratis/Studio/pull/42", true));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_pull_request_registered() => _scenario.EventSequence.ShouldHaveAppendedEvent<PullRequestRegistered>(
        @event =>
            @event.Owner == new OrganizationName("Cratis") &&
            @event.Repository == new RepositoryName("Studio") &&
            @event.Number == new PullRequestNumber(42) &&
            @event.Title == new PullRequestTitle("Fix the thing") &&
            @event.IsOpen);
}
#endif
