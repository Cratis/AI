// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class with_a_custom_observation_cache : given.a_snapshot_cache
{
    IAIProviderCapacityObservations _custom;
    AIProviderCapacitySnapshot _snapshot;
    void Establish() => _custom = Substitute.For<IAIProviderCapacityObservations>();
    void Because() => _snapshot = new AIProviderCapacitySnapshots(_custom, _clock, Options.Create(new AIProviderOptions())).Capture(_provider);
    [Fact] void should_explain_the_missing_capability() => _snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.CacheNotSupported);
    [Fact] void should_not_invoke_the_custom_cache() => _custom.ReceivedCalls().ShouldBeEmpty();
}
