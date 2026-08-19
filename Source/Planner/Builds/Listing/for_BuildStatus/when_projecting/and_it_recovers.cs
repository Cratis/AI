// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Builds.RecordingStatus;

namespace Planner.Builds.Listing.for_BuildStatus.when_projecting;

public class and_it_recovers : Specification
{
    static readonly BuildWorkflowId _id = BuildWorkflowId.From("Cratis", "Studio", "Update Packages");

    ReadModelScenario<BuildStatus> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new BuildStatusRecorded("Cratis", "Studio", "Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/1", DateTimeOffset.UnixEpoch),
                new BuildStatusRecorded("Cratis", "Studio", "Update Packages", BuildConclusion.Success, "https://github.com/Cratis/Studio/actions/runs/2", DateTimeOffset.UnixEpoch.AddDays(1)));

    [Fact] void should_hold_the_latest_conclusion() => _scenario.Instance.Conclusion.ShouldEqual(BuildConclusion.Success);
    [Fact] void should_hold_the_latest_run_url() => _scenario.Instance.RunUrl.ShouldEqual(new BuildRunUrl("https://github.com/Cratis/Studio/actions/runs/2"));
}
#endif
