// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_a_window_reset : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish()
    {
        await Observe(AIProviderCapacityReport.Subscription([new(UsageWindowKind.FiveHour, "5h", 1, _start.AddMinutes(1))]));
        _clock.Now += TimeSpan.FromMinutes(1);
    }
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_be_stale() => _snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.ResetElapsed);
    [Fact] void should_not_turn_an_elapsed_reset_into_new_allowance() => _snapshot.Windows.Single().Remaining.ShouldEqual(0.0);
    [Fact] void should_retain_the_reported_reset() => _snapshot.Windows.Single().ResetsAt.ShouldEqual(_start.AddMinutes(1));
}
