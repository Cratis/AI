// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_forgetting : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish()
    {
        await Observe(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "weekly", 0.5, null)]));
        _observations.Forget(_provider);
    }
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_mark_the_last_good_stale() => _snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.Invalidated);
    [Fact] void should_preserve_the_last_good_allowance() => _snapshot.Windows.Single().Remaining.ShouldEqual(0.5);
    [Fact] void should_preserve_the_original_observation_time() => _snapshot.ObservedAt.ShouldEqual(_start);
}
