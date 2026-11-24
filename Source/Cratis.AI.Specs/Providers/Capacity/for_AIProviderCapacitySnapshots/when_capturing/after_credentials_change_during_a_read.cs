// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_credentials_change_during_a_read : given.a_snapshot_cache
{
    readonly TaskCompletionSource<AIProviderCapacityReport> _pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Task<AIProviderCapacityObservation> _oldRead;
    Task<AIProviderCapacityObservation> _newRead;
    AIProviderCapacitySnapshot _snapshot;
    void Establish()
    {
        _oldRead = _observations.Observe(_provider, _ => _pending.Task, "old-account");
        _newRead = _observations.Observe(_provider, _ => Task.FromResult(AIProviderCapacityReport.Unmetered()), "new-account");
    }
    async Task Because()
    {
        _pending.SetResult(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "old-account", 0.1, null)]));
        await Task.WhenAll(_oldRead, _newRead);
        _snapshot = _snapshots.Capture(_provider);
    }
    [Fact] void should_not_publish_the_old_accounts_inflight_result() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Unavailable);
    [Fact] void should_not_leak_the_old_accounts_windows() => _snapshot.Windows.ShouldBeEmpty();
}
