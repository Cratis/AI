// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Grouping.RemovingIssue;

namespace Planner.Issues.Grouping.Deleting.when_deleting_group;

public class and_it_has_members : Specification
{
    static readonly GroupId _groupId = GroupId.New();

    CommandScenario<DeleteGroup> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new DeleteGroup(_groupId, [new IssueId("cratis-studio-1"), new IssueId("cratis-studio-2")]));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_append_group_deleted_on_the_group_stream() =>
        await _scenario.EventSequence.ShouldHaveAppendedEvent<GroupDeleted>(_groupId, _ => true);

    [Fact]
    async Task should_remove_the_first_issue_from_the_group() =>
        await _scenario.EventSequence.ShouldHaveAppendedEvent<IssueRemovedFromGroup>("cratis-studio-1", _ => true);

    [Fact]
    async Task should_remove_the_second_issue_from_the_group() =>
        await _scenario.EventSequence.ShouldHaveAppendedEvent<IssueRemovedFromGroup>("cratis-studio-2", _ => true);
}
#endif
