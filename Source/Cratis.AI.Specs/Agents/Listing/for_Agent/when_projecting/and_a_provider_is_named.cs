// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AIRole.when_projecting;

public class and_a_provider_is_named : Specification
{
    static readonly AgentId _id = AgentId.For("Conversation");
    static readonly AIProviderId _provider = AIProviderId.New();

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(new AgentConfigured("Conversation", "System", "The default conversational agent.", ModelTier.Fast, ProviderId: _provider, PoolId: null, Harness.Claude, Effort.High));

    [Fact] void should_hold_the_provider_id() => _scenario.Instance!.ProviderId.ShouldEqual(_provider);
    [Fact] void should_not_hold_a_pool_id() => _scenario.Instance!.PoolId.ShouldBeNull();
}
