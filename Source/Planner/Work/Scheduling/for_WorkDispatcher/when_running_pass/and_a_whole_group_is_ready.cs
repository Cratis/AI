// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Grouping;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_a_whole_group_is_ready : given.all_dependencies
{
    static readonly GroupId _group = GroupId.New();

    void Establish()
    {
        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.ReadyForDevelopment, _group));
        _issuesData.Add(Issue("cratis-studio-2", Issues.IssueStatus.ReadyForDevelopment, _group));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_schedule_one_unit_of_work_covering_the_whole_group() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ScheduleWork>(command =>
            command.Purpose == WorkPurpose.Implementation &&
            command.Issues.Count() == 2));
}
#endif
