// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.ChangingMilestone.when_changing_issue_milestone;

public class and_a_milestone_is_given : Specification
{
    CommandScenario<ChangeIssueMilestone> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ChangeIssueMilestone("cratis-studio-256", "v1.0"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_issue_milestone_changed() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueMilestoneChanged>(
        @event => @event.Milestone == new MilestoneName("v1.0"));
}
#endif
