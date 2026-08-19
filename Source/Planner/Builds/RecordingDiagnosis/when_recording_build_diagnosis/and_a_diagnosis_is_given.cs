// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Builds.RecordingDiagnosis.when_recording_build_diagnosis;

public class and_a_diagnosis_is_given : Specification
{
    static readonly BuildWorkflowId _id = BuildWorkflowId.From("Cratis", "Studio", "Update Packages");

    CommandScenario<RecordBuildDiagnosis> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RecordBuildDiagnosis(_id, "A dependency bump broke the build", true));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_build_diagnosis_recorded() => _scenario.EventSequence.ShouldHaveAppendedEvent<BuildDiagnosisRecorded>(
        @event => @event.Diagnosis == new BuildDiagnosis("A dependency bump broke the build") && @event.Fixable);
}
#endif
