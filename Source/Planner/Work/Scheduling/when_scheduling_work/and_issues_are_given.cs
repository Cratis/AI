// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Scheduling.when_scheduling_work;

public class and_issues_are_given : Specification
{
    CommandScenario<ScheduleWork> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new ScheduleWork(WorkPurpose.Implementation, [new IssueId("cratis-studio-1")]));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_work_scheduled_with_the_model_unset() => _scenario.EventSequence.ShouldHaveAppendedEvent<WorkScheduled>(
        @event =>
            @event.Purpose == WorkPurpose.Implementation &&
            @event.Issues.Single() == new IssueId("cratis-studio-1") &&
            @event.Model == ModelName.NotSet);
}
#endif
