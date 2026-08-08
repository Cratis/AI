// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Work.Listing;
using Planner.Work.Workers;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_the_account_is_at_concurrent_capacity : given.all_dependencies
{
    void Establish()
    {
        var account = AddAccountWithCredentials();
        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.InProgress));
        _issuesData.Add(Issue("cratis-studio-2", Issues.IssueStatus.None));
        _workItemsData.Add(new WorkItem(WorkId.New(), WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet, WorkStatus.Running, account.Id, _now.AddMinutes(-10)));
        _workItemsData.Add(new WorkItem(WorkId.New(), WorkPurpose.Implementation, [new IssueId("cratis-studio-2")], ModelName.NotSet, UserName.NotSet));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_not_launch_a_worker() =>
        await _workerRuntime.DidNotReceive().Start(Arg.Any<WorkerJob>(), Arg.Any<CancellationToken>());
}
#endif
