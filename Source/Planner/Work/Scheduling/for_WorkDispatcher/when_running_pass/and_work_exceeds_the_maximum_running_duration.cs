// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Accounts;
using Planner.Work.Failing;
using Planner.Work.Listing;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_work_exceeds_the_maximum_running_duration : given.all_dependencies
{
    static readonly WorkId _workId = WorkId.New();

    void Establish()
    {
        _schedulingOptions.MaxRunningDuration = TimeSpan.FromHours(24);
        _workItemsData.Add(new WorkItem(_workId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet, WorkStatus.Running, AccountId.New(), _now.AddHours(-25)));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_stop_the_worker() =>
        await _workerRuntime.Received(1).Stop(_workId, Arg.Any<CancellationToken>());

    [Fact]
    async Task should_fail_the_work_as_swept() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<FailWork>(command => command.Work == _workId));
}
#endif
