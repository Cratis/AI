// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Agents.Defining;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Agents.Listing.for_Agent.when_projecting;

public class and_a_provider_is_replaced_by_another_provider : Specification
{
    static readonly AgentId _id = AgentId.For("Conversation");
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly AgentRoleConfigured _role = new("Conversation", "System", "Talks.", ModelTier.Fast, Harness.Pi, Effort.High);

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_id).Events(
        _role,
        new AgentAssignedToProvider(AIProviderId.New()),
        new AgentAssignedToProvider(_provider));

    [Fact] void should_hold_the_latest_provider() => _scenario.Instance!.ProviderId.ShouldEqual(_provider);
}
