// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class at_the_freshness_limit : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish()
    {
        await Observe(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "weekly", 1, null)]));
        _clock.Now += TimeSpan.FromMinutes(5);
    }
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_be_stale_at_the_exact_limit() => _snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.Expired);
    [Fact] void should_preserve_known_exhaustion() => _snapshot.Windows.Single().Remaining.ShouldEqual(0.0);
    [Fact] void should_preserve_the_observation_time() => _snapshot.ObservedAt.ShouldEqual(_start);
    [Fact] void should_not_refresh() => _reads.ShouldEqual(1);
}
