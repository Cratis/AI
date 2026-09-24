// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AIRole.when_projecting;

/// <summary>
/// The effort is additive with a High default, so an agent configured before effort was per-agent
/// replays as High, and a later reconfiguration carries the chosen one.
/// </summary>
public class and_an_effort_is_set : Specification
{
    static readonly AgentId _id = AgentId.For("WorkExecution");

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new AgentConfigured("WorkExecution", "Wright", "Carries out scheduled units of work.", ModelTier.Balanced, ProviderId: null, PoolId: null, Harness.Pi, Effort.Low),
                new AgentConfigured("WorkExecution", "Wright", "Carries out scheduled units of work.", ModelTier.Balanced, ProviderId: null, PoolId: null, Harness.Pi, Effort.ExtraHigh));

    [Fact] void should_carry_the_chosen_effort() => _scenario.Instance.Effort.ShouldEqual(Effort.ExtraHigh);
}
