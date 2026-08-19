// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Builds.RecordingDiagnosis;
using Planner.Builds.RecordingStatus;
using Planner.LanguageModels;
using Planner.Work.SchedulingAdHoc;

namespace Planner.Builds.Analyzing.for_BuildFailureAnalysis.when_a_workflow_starts_failing;

public class and_the_model_judges_it_not_fixable : given.a_reactor
{
    void Establish() =>
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(LanguageModelResult.Success(
            """
            { "diagnosis": "The cluster credentials look expired", "fixable": false }
            """));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workflowId)
            .Events(new BuildStatusRecorded("Cratis", "Studio", "Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/1", DateTimeOffset.UnixEpoch, true));

    [Fact]
    async Task should_record_the_diagnosis() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordBuildDiagnosis>(command => !command.Fixable));

    [Fact]
    async Task should_not_schedule_any_work() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<ScheduleAdHocWork>());
}
#endif
