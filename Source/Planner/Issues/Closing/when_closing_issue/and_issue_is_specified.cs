// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Closing.when_closing_issue;

public class and_issue_is_specified : Specification
{
    CommandScenario<CloseIssue> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new CloseIssue("cratis-studio-256"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_issue_closed() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueClosed>();
}
#endif
