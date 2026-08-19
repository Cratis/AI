// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Builds.RecordingStatus;

namespace Planner.Builds.Listing.for_BuildStatus.when_projecting;

public class and_a_status_is_recorded : Specification
{
    static readonly BuildWorkflowId _id = BuildWorkflowId.From("Cratis", "Studio", "Update Packages");
    static readonly DateTimeOffset _ranAt = new(2026, 8, 19, 10, 0, 0, TimeSpan.Zero);

    ReadModelScenario<BuildStatus> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(new BuildStatusRecorded("Cratis", "Studio", "Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/1", _ranAt, true));

    [Fact] void should_hold_the_conclusion() => _scenario.Instance.Conclusion.ShouldEqual(BuildConclusion.Failure);
    [Fact] void should_hold_the_run_url() => _scenario.Instance.RunUrl.ShouldEqual(new BuildRunUrl("https://github.com/Cratis/Studio/actions/runs/1"));
}
#endif
