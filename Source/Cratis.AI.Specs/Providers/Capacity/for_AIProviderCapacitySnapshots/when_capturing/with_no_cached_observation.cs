// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class with_no_cached_observation : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_be_unavailable() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Unavailable);
    [Fact] void should_not_invent_an_observation_time() => _snapshot.ObservedAt.ShouldEqual(AIProviderCapacitySnapshot.UnknownTime);
    [Fact] void should_not_claim_full_allowance() => _snapshot.Windows.ShouldBeEmpty();
    [Fact] void should_not_start_a_read() => _reads.ShouldEqual(0);
    [Fact] void should_not_resolve_configuration() => _readModels.ReceivedCalls().ShouldBeEmpty();
}
