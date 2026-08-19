// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Builds.RecordingDiagnosis;
using Planner.Builds.RecordingStatus;
using Planner.LanguageModels;
using Planner.Work.SchedulingAdHoc;

namespace Planner.Builds.Analyzing.for_BuildFailureAnalysis.when_a_workflow_starts_failing;

public class and_the_model_judges_it_fixable : given.a_reactor
{
    void Establish() =>
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(LanguageModelResult.Success(
            """
            { "diagnosis": "A dependency bump broke the build", "fixable": true }
            """));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workflowId)
            .Events(new BuildStatusRecorded("Cratis", "Studio", "Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/1", DateTimeOffset.UnixEpoch, true));

    [Fact]
    async Task should_record_the_diagnosis() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordBuildDiagnosis>(command =>
            command.Workflow == _workflowId && command.Fixable));

    [Fact]
    async Task should_schedule_ad_hoc_work() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ScheduleAdHocWork>(command =>
            command.Repositories!.Single() == RepositoryId.From("Cratis", "Studio")));
}
#endif
