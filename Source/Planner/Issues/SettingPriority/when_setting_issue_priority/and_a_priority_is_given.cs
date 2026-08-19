// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.SettingPriority.when_setting_issue_priority;

public class and_a_priority_is_given : Specification
{
    CommandScenario<SetIssuePriority> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetIssuePriority("cratis-studio-256", Priority.Critical));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_issue_priority_set() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssuePrioritySet>(
        @event => @event.Priority == Priority.Critical);
}
#endif
