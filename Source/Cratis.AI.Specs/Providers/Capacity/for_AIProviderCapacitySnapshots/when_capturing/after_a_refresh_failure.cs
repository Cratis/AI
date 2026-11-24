// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_a_refresh_failure : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish()
    {
        await Observe(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "weekly", 0.75, null)]));
        _clock.Now += TimeSpan.FromMinutes(5);
        await Observe(AIProviderCapacityReport.Unavailable("sensitive vendor response"));
    }
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_retain_last_good_allowance() => _snapshot.Windows.Single().Remaining.ShouldEqual(0.25);
    [Fact] void should_preserve_the_original_time() => _snapshot.ObservedAt.ShouldEqual(_start);
    [Fact] void should_be_stale() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Stale);
    [Fact] void should_use_a_fixed_reason() => _snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.RefreshFailed);
    [Fact] void should_not_refresh_during_capture() => _reads.ShouldEqual(2);
}
