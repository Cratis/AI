// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues;
using Planner.Work.Listing;
using Planner.Work.Workers;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_priority_is_equal : given.all_dependencies
{
    static readonly WorkId _laterWorkId = WorkId.New();
    static readonly WorkId _earlierWorkId = WorkId.New();

    void Establish()
    {
        // Same priority on both, but the manual sort order says the second issue comes first -
        // that has to break the tie ahead of whatever order the work happened to be found in.
        AddAccountWithCredentials();
        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.ReadyForDevelopment, priority: Priority.High, order: new SortOrder(2)));
        _issuesData.Add(Issue("cratis-studio-2", Issues.IssueStatus.ReadyForDevelopment, priority: Priority.High, order: new SortOrder(1)));
        _workItemsData.Add(new WorkItem(_laterWorkId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet));
        _workItemsData.Add(new WorkItem(_earlierWorkId, WorkPurpose.Implementation, [new IssueId("cratis-studio-2")], ModelName.NotSet, UserName.NotSet));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_launch_the_worker_for_the_earlier_sort_order() =>
        await _workerRuntime.Received(1).Start(Arg.Is<WorkerJob>(job => job.Work == _earlierWorkId), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_not_launch_the_worker_for_the_later_sort_order() =>
        await _workerRuntime.DidNotReceive().Start(Arg.Is<WorkerJob>(job => job.Work == _laterWorkId), Arg.Any<CancellationToken>());
}
#endif
