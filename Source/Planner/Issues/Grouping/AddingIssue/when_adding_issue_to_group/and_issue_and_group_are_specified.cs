// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Grouping.Creating;

namespace Planner.Issues.Grouping.AddingIssue.when_adding_issue_to_group;

public class and_issue_and_group_are_specified : Specification
{
    static readonly GroupId _groupId = GroupId.New();

    CommandScenario<AddIssueToGroup> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new AddIssueToGroup(_groupId, "cratis-studio-256"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_append_issue_added_to_group_on_the_issue_stream() =>
        await _scenario.EventSequence.ShouldHaveAppendedEvent<IssueAddedToGroup>(
            "cratis-studio-256",
            @event => @event.Group == _groupId);
}
#endif
