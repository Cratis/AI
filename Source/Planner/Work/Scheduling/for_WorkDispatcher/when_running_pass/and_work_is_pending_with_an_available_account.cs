// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Work.Listing;
using Planner.Work.Starting;
using Planner.Work.Workers;

namespace Planner.Work.Scheduling.for_WorkDispatcher.when_running_pass;

public class and_work_is_pending_with_an_available_account : given.all_dependencies
{
    static readonly WorkId _workId = WorkId.New();

    void Establish()
    {
        AddAccountWithCredentials();
        _issuesData.Add(Issue("cratis-studio-1", Issues.IssueStatus.ReadyForDevelopment));
        _workItemsData.Add(new WorkItem(_workId, WorkPurpose.Implementation, [new IssueId("cratis-studio-1")], ModelName.NotSet, UserName.NotSet));
    }

    async Task Because() => await _dispatcher.RunSchedulingPass();

    [Fact]
    async Task should_launch_a_worker_for_the_work() =>
        await _workerRuntime.Received(1).Start(
            Arg.Is<WorkerJob>(job =>
                job.Work == _workId &&
                job.EnvironmentVariables.ContainsKey("PLANNER_PROMPT") &&
                job.Secrets["CLAUDE_CODE_OAUTH_TOKEN"] == "sk-ant-token" &&

                // The credentials must not also travel on the container specification, which is
                // what `kubectl get job -o yaml` and `docker inspect` read back.
                !job.EnvironmentVariables.ContainsKey("CLAUDE_CODE_OAUTH_TOKEN") &&
                !job.EnvironmentVariables.ContainsKey("PLANNER_CALLBACK_TOKEN")),
            Arg.Any<CancellationToken>());

    [Fact]
    async Task should_record_the_start_with_the_default_model() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<StartWork>(command =>
            command.Work == _workId &&
            command.Model == new ModelName("sonnet")));
}
#endif
