// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Builds.RecordingStatus;
using Planner.GitHub;
using Repository = Planner.Repositories.Listing.Repository;

namespace Planner.Builds.CheckingStatus.for_BuildStatusChecker.when_checking_all;

public class and_a_workflow_is_failing : given.all_dependencies
{
    void Establish()
    {
        _repositoriesData.Add(new Repository(
            RepositoryId.From("Cratis", "Studio"), "Cratis", "Studio", null, null, Repositories.IssueSynchronizationStatus.Synchronized, string.Empty));

        _gitHub.GetLatestWorkflowRuns(new OrganizationName("Cratis"), new RepositoryName("Studio"), Arg.Any<CancellationToken>())
            .Returns(
            [
                new GitHubWorkflowRun("Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/1", DateTimeOffset.UnixEpoch),
                new GitHubWorkflowRun("Build", BuildConclusion.Success, "https://github.com/Cratis/Studio/actions/runs/2", DateTimeOffset.UnixEpoch)
            ]);
    }

    async Task Because() => await _checker.CheckAll();

    [Fact]
    async Task should_record_the_failing_workflow() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordBuildStatus>(command =>
            command.Workflow == new WorkflowName("Update Packages") && command.Conclusion == BuildConclusion.Failure));

    [Fact]
    async Task should_record_the_passing_workflow_too() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordBuildStatus>(command =>
            command.Workflow == new WorkflowName("Build") && command.Conclusion == BuildConclusion.Success));
}
#endif
