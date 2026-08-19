// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Builds.RecordingStatus.when_recording_build_status;

public class and_a_conclusion_is_given : Specification
{
    static readonly DateTimeOffset _ranAt = new(2026, 8, 19, 10, 0, 0, TimeSpan.Zero);

    CommandScenario<RecordBuildStatus> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RecordBuildStatus(
        "Cratis", "Studio", "Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/1", _ranAt));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_build_status_recorded() => _scenario.EventSequence.ShouldHaveAppendedEvent<BuildStatusRecorded>(
        @event =>
            @event.Owner == new OrganizationName("Cratis") &&
            @event.Repository == new RepositoryName("Studio") &&
            @event.Workflow == new WorkflowName("Update Packages") &&
            @event.Conclusion == BuildConclusion.Failure &&
            @event.RanAt == _ranAt);
}
#endif
