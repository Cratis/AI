// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Reopening.when_reopening_issue;

public class and_issue_is_specified : Specification
{
    CommandScenario<ReopenIssue> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ReopenIssue("cratis-studio-256"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_issue_reopened() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueReopened>();
}
#endif
