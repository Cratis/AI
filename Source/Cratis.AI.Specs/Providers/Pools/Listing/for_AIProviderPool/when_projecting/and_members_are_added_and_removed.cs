// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Pools.AddingProvider;
using Cratis.AI.Providers.Pools.Creating;
using Cratis.AI.Providers.Pools.RemovingProvider;

namespace Cratis.AI.Providers.Pools.Listing.for_AIProviderPool.when_projecting;

public class and_members_are_added_and_removed : Specification
{
    static readonly AIProviderPoolId _id = AIProviderPoolId.New();
    static readonly AIProviderId _kept = AIProviderId.New();
    static readonly AIProviderId _removed = AIProviderId.New();

    ReadModelScenario<AIProviderPool> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new AIProviderPoolCreated("Main pool"),
                new ProviderAddedToPool(_kept),
                new ProviderAddedToPool(_removed),
                new ProviderRemovedFromPool(_removed));

    [Fact] void should_hold_the_name() => _scenario.Instance.Name.ShouldEqual(new AIProviderPoolName("Main pool"));
    [Fact] void should_hold_one_member() => _scenario.Instance.Members!.Count().ShouldEqual(1);
    [Fact] void should_hold_the_kept_member() => _scenario.Instance.Members!.First().ProviderId.ShouldEqual(_kept);
}
