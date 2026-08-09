// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_an_ungrouped_issue_is_ready : given.all_dependencies
{
    void Establish() => _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.ReadyForDevelopment, suggestedModel: new ModelName("sonnet")));

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_schedule_implementation_work_for_the_issue() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ScheduleWork>(command =>
            command.Purpose == WorkPurpose.Implementation &&
            command.Issues.Single() == new IssueId("cratis-studio-1") &&
            command.Model == new ModelName("sonnet")));
}
#endif
