// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Grouping.Creating.when_creating_group;

public class and_two_issues_are_given : Specification
{
    CommandScenario<CreateGroup> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new CreateGroup("Authentication work", [new IssueId("cratis-studio-1"), new IssueId("cratis-studio-2")]));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_group_created() => _scenario.EventSequence.ShouldHaveAppendedEvent<GroupCreated>(
        @event => @event.Name == new GroupName("Authentication work"));

    [Fact]
    async Task should_add_the_first_issue_to_the_group() =>
        await _scenario.EventSequence.ShouldHaveAppendedEvent<IssueAddedToGroup>("cratis-studio-1", _ => true);

    [Fact]
    async Task should_add_the_second_issue_to_the_group() =>
        await _scenario.EventSequence.ShouldHaveAppendedEvent<IssueAddedToGroup>("cratis-studio-2", _ => true);
}
#endif
