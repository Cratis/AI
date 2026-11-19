// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Configuring;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Configuration.Seeding.for_SeededAgentPresence.when_projecting;

public class and_the_agent_was_configured : Specification
{
    static readonly AgentId _id = AgentId.For("Greeting");

    ReadModelScenario<SeededAgentPresence> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(new AgentConfigured("Greeting", "Greeter", "Greets", ModelTier.Fast, AIProviderId.New(), null, Harness.Pi, Effort.High));

    [Fact] void should_be_present() => _scenario.Instance.ShouldNotBeNull();
}
