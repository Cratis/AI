// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Grouping;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_a_grouped_issue_waits_for_its_group : given.all_dependencies
{
    static readonly GroupId _group = GroupId.New();

    void Establish()
    {
        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.ReadyForDevelopment, _group));
        _issuesData.Add(Issue("cratis-studio-2", Issues.IssueStatus.None, _group));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_not_schedule_any_work() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<ScheduleWork>());
}
#endif
