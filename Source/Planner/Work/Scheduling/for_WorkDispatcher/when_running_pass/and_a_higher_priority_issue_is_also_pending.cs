// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues;
using Planner.Work.Listing;
using Planner.Work.Workers;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_a_higher_priority_issue_is_also_pending : given.all_dependencies
{
    static readonly WorkId _normalWorkId = WorkId.New();
    static readonly WorkId _criticalWorkId = WorkId.New();

    void Establish()
    {
        // Default concurrency is one unit of work per account, so only the higher-priority work
        // item can actually be dispatched this pass - the normal one has to wait.
        AddAccountWithCredentials();
        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.ReadyForDevelopment, priority: Priority.Normal));
        _issuesData.Add(Issue("cratis-studio-2", Issues.IssueStatus.ReadyForDevelopment, priority: Priority.Critical));
        _workItemsData.Add(new WorkItem(_normalWorkId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet));
        _workItemsData.Add(new WorkItem(_criticalWorkId, WorkPurpose.Implementation, [new IssueId("cratis-studio-2")], ModelName.NotSet, UserName.NotSet));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_launch_the_worker_for_the_critical_issue() =>
        await _workerRuntime.Received(1).Start(Arg.Is<WorkerJob>(job => job.Work == _criticalWorkId), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_not_launch_the_worker_for_the_normal_issue() =>
        await _workerRuntime.DidNotReceive().Start(Arg.Is<WorkerJob>(job => job.Work == _normalWorkId), Arg.Any<CancellationToken>());
}
#endif
