// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.PullRequests.Closing.when_closing_pull_request;

public class and_it_was_merged : Specification
{
    CommandScenario<ClosePullRequest> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ClosePullRequest("cratis-studio-42", true));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_pull_request_closed_as_merged() => _scenario.EventSequence.ShouldHaveAppendedEvent<PullRequestClosed>(
        @event => @event.Merged);
}
#endif
