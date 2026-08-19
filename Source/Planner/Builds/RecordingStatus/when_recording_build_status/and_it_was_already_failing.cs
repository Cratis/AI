// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Builds.Listing;

namespace Planner.Builds.RecordingStatus.when_recording_build_status;

public class and_it_was_already_failing : Specification
{
    static readonly BuildWorkflowId _id = BuildWorkflowId.From("Cratis", "Studio", "Update Packages");

    CommandScenario<RecordBuildStatus> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        _scenario.Given.ForEventSource(_id).ReadModel(new BuildStatus(
            _id, "Cratis", "Studio", "Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/1", DateTimeOffset.UnixEpoch));
    }

    async Task Because() => _result = await _scenario.Execute(new RecordBuildStatus(
        "Cratis", "Studio", "Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/2", DateTimeOffset.UnixEpoch.AddDays(1)));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_not_flag_it_as_a_new_failure() => _scenario.EventSequence.ShouldHaveAppendedEvent<BuildStatusRecorded>(
        @event => !@event.IsNewFailure);
}
#endif
