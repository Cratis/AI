// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class without_a_provider : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    void Because() => _snapshot = _snapshots.Capture(AIProviderId.NotSet);
    [Fact] void should_be_unavailable() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Unavailable);
    [Fact] void should_explain_the_missing_provider() => _snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.ProviderNotResolved);
    [Fact] void should_not_invent_a_provider() => _snapshot.Provider.ShouldEqual(AIProviderId.NotSet);
}
