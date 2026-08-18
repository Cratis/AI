// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.ChangingAssignees.when_changing_assignees;

public class and_all_assignees_are_removed : Specification
{
    CommandScenario<ChangeIssueAssignees> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ChangeIssueAssignees("cratis-studio-256", []));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_issue_assignees_changed_with_an_empty_set() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueAssigneesChanged>(
        @event => !@event.Assignees.Any());
}
#endif
