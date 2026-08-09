// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.PullRequests.Reopening.when_reopening_pull_request;

public class and_pull_request_is_specified : Specification
{
    CommandScenario<ReopenPullRequest> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ReopenPullRequest("cratis-studio-42"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_pull_request_reopened() => _scenario.EventSequence.ShouldHaveAppendedEvent<PullRequestReopened>();
}
#endif
