// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using NSubstitute.ExceptionExtensions;
using Planner.Work.Failing;
using Planner.Work.Listing;
using Planner.Work.Workers;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

/// <summary>
/// Proves the failure branch of <c>Dispatch</c> independently of the success branch it shares a
/// <c>using var scope = systemExecution.AsSystem()</c> with: when the worker runtime throws while
/// launching, the work is failed and the trusted system scope still covers that failure. Both branches
/// happening to be covered by the same code today is not a guarantee a future refactor that split them
/// would keep it that way - only a spec on the failure branch by itself catches that.
/// </summary>
public class and_the_worker_runtime_throws_while_launching : given.all_dependencies
{
    static readonly WorkId _workId = WorkId.New();

    void Establish()
    {
        AddAccountWithCredentials();
        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.ReadyForDevelopment));
        _workItemsData.Add(new WorkItem(_workId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet));
        _workerRuntime.Start(Arg.Any<WorkerJob>(), Arg.Any<CancellationToken>()).Throws(new Exception("Worker runtime unavailable."));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_fail_the_work() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<FailWork>(command => command.Work == _workId));

    // Exactly one: the launch attempt and the FailWork call that follows when it throws share a
    // single scope, entered only once launch is actually attempted.
    [Fact] void should_fail_as_the_system() => _systemExecution.Received(1).AsSystem();
}
#endif
