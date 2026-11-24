// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_forgetting_a_fallback : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish()
    {
        Configure(new(_provider, AIProviderType.OpenAI, new("key")));
        await _capacities.For(_provider);
        _clock.Now += TimeSpan.FromMinutes(1);
        _observations.Forget(_provider);
    }
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_keep_the_fallback_source() => _snapshot.Source.ShouldEqual(AIProviderCapacitySource.Unmetered);
    [Fact] void should_mark_it_stale() => _snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.Invalidated);
    [Fact] void should_keep_the_calculation_time() => _snapshot.ObservedAt.ShouldEqual(_start);
}
