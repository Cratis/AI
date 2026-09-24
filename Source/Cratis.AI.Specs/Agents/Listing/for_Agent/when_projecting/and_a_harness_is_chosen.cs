// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AIRole.when_projecting;

/// <summary>
/// The harness is additive with a Pi default, so an agent configured before harnesses were
/// per-agent replays as Pi, and a later reconfiguration carries the chosen one.
/// </summary>
public class and_a_harness_is_chosen : Specification
{
    static readonly AgentId _id = AgentId.For("WorkExecution");

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new AgentConfigured("WorkExecution", "Wright", "Carries out scheduled units of work.", ModelTier.Balanced, ProviderId: null, PoolId: null, Harness.Claude, Effort.High),
                new AgentConfigured("WorkExecution", "Wright", "Carries out scheduled units of work.", ModelTier.Balanced, ProviderId: null, PoolId: null, Harness.Pi, Effort.High));

    [Fact] void should_carry_the_chosen_harness() => _scenario.Instance.Harness.ShouldEqual(Harness.Pi);
}
