// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Defining;
using Cratis.AI.Harnesses;
using Cratis.AI.Providers;

namespace Cratis.AI.Configuration.Seeding.for_SeededAgentPresence.when_projecting;

public class and_the_agent_role_was_configured : Specification
{
    static readonly AgentId _id = AgentId.For("Greeting");

    ReadModelScenario<SeededAgentPresence> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new AgentRoleConfigured("Greeting", "Greeter", "Greets", ModelTier.Fast, Harness.Pi, Effort.High),
                new AgentAssignmentCleared());

    [Fact] void should_be_present() => _scenario.Instance.ShouldNotBeNull();
    [Fact] void should_hold_the_name() => _scenario.Instance!.Name.ShouldEqual(new AgentName("Greeter"));
}
