// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts;
using Planner.Work.Failing;
using Planner.Work.Listing;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_the_maximum_running_duration_is_disabled : given.all_dependencies
{
    static readonly WorkId _workId = WorkId.New();

    void Establish()
    {
        _schedulingOptions.MaxRunningDuration = TimeSpan.Zero;

        // Absurdly overdue - the sweep must still never fire while it is switched off.
        _workItemsData.Add(new WorkItem(_workId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet, WorkStatus.Running, AccountId.New(), _now.AddDays(-30)));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_not_stop_the_worker() =>
        await _workerRuntime.DidNotReceive().Stop(Arg.Any<WorkId>(), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_not_fail_the_work() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<FailWork>());
}
#endif
