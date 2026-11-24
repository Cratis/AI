// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class with_known_exhaustion : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish() => await Observe(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "weekly", 1, null)]));
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_be_available_information() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Available);
    [Fact] void should_be_zero_remaining_not_unknown() => _snapshot.Windows.Single().Remaining.ShouldEqual(0.0);
}
