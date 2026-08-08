// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Grouping.RemovingIssue.when_removing_issue_from_group;

public class and_issue_is_specified : Specification
{
    CommandScenario<RemoveIssueFromGroup> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RemoveIssueFromGroup("cratis-studio-256"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_issue_removed_from_group() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueRemovedFromGroup>();
}
#endif
