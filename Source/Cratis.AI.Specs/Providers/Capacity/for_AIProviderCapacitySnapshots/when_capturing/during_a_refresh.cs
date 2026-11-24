// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class during_a_refresh : given.a_snapshot_cache
{
    readonly TaskCompletionSource<AIProviderCapacityReport> _pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Task<AIProviderCapacityObservation> _refresh;
    AIProviderCapacitySnapshot _snapshot;
    bool _wasPending;
    async Task Establish()
    {
        await Observe(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "weekly", 0.5, null)]));
        _clock.Now += TimeSpan.FromMinutes(5);
        _refresh = _observations.Observe(_provider, _ => _pending.Task);
    }
    async Task Because()
    {
        _snapshot = _snapshots.Capture(_provider);
        _wasPending = !_refresh.IsCompleted;
        _pending.SetResult(AIProviderCapacityReport.Unmetered());
        await _refresh;
    }
    [Fact] void should_return_without_waiting_for_the_refresh() => _wasPending.ShouldBeTrue();
    [Fact] void should_return_the_last_observation() => _snapshot.Windows.Single().Remaining.ShouldEqual(0.5);
    [Fact] void should_keep_the_observation_stale() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Stale);
}
