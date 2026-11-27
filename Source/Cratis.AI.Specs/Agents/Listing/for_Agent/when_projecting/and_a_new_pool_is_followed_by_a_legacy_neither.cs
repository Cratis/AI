// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Agents.Defining;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Agents.Listing.for_Agent.when_projecting;

public class and_a_new_pool_is_followed_by_a_legacy_neither : Specification
{
    static readonly AgentId _id = AgentId.For("Conversation");
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AgentRoleConfigured _role = new("Conversation", "System", "Talks.", ModelTier.Fast, Harness.Pi, Effort.High);

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_id).Events(
        _role,
        new AgentAssignedToPool(_pool),
        new AgentConfigured("Conversation", "System", "Talks.", ModelTier.Fast, null, null, Harness.Pi, Effort.High));

    [Fact] void should_have_no_provider() => _scenario.Instance!.ProviderId.ShouldBeNull();
    [Fact] void should_have_no_pool() => _scenario.Instance!.PoolId.ShouldBeNull();
}
