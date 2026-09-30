// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AIRole.when_projecting;

public class and_a_historical_harness_is_replayed : Specification
{
    static readonly AgentId _id = AgentId.For("WorkExecution");
    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_id).Events(
        new AgentConfigured("WorkExecution", "Wright", "Carries out scheduled units of work.", ModelTier.Balanced, ProviderId: null, PoolId: null, Harness.Claude, Effort.High));

    [Fact] void should_retain_the_historical_harness_for_unconfigured_providers() => _scenario.Instance.Harness.ShouldEqual(Harness.Claude);
}
