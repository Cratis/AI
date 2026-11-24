// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Agents.Defining;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Agents.Listing.for_Agent.when_projecting;

public class and_a_legacy_provider_is_replayed : Specification
{
    static readonly AgentId _id = AgentId.For("Conversation");
    static readonly AIProviderId _provider = AIProviderId.New();

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_id).Events(
        new AgentConfigured("Conversation", "System", "Talks.", ModelTier.Fast, _provider, null, Harness.Claude, Effort.Low));

    [Fact] void should_hold_the_provider() => _scenario.Instance!.ProviderId.ShouldEqual(_provider);
    [Fact] void should_have_no_pool() => _scenario.Instance!.PoolId.ShouldBeNull();
    [Fact] void should_hold_the_legacy_harness_and_effort() => (_scenario.Instance!.Harness, _scenario.Instance.Effort).ShouldEqual((Harness.Claude, Effort.Low));
}
