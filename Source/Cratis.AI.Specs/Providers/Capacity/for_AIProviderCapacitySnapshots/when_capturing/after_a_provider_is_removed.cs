// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_a_provider_is_removed : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish()
    {
        Configure(new(_provider, AIProviderType.OpenAI, new("key")));
        await _capacities.For(_provider);
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_provider).Returns((ConfiguredAIProvider)null!);
        await _capacities.For(_provider);
    }
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_clear_the_old_fallback() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Unavailable);
    [Fact] void should_not_invent_allowance() => _snapshot.Windows.ShouldBeEmpty();
}
