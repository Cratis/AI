// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Agents.Defining;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Agents.Listing.for_Agent.when_projecting;

public class and_a_legacy_pool_is_replayed : Specification
{
    static readonly AgentId _id = AgentId.For("Conversation");
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_id).Events(
        new AgentConfigured("Conversation", "System", "Talks.", ModelTier.Fast, null, _pool, Harness.Pi, Effort.High));

    [Fact] void should_hold_the_pool() => _scenario.Instance!.PoolId.ShouldEqual(_pool);
    [Fact] void should_have_no_provider() => _scenario.Instance!.ProviderId.ShouldBeNull();
}
