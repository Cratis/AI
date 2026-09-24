// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Providers;
using Cratis.Chronicle;
using Cratis.Chronicle.Identities;
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Agents.Naming.when_an_agent_is_configured;

/// <summary>
/// The agent's Chronicle identity takes the configured name, so every event it has caused - past ones
/// included, since Chronicle resolves the name from the identity - reads under the name people gave it.
/// </summary>
public class and_it_is_given_a_name : Specification
{
    IEventStore _eventStore;
    IIdentityManager _identities;
    ReactorScenario<AgentIdentityNaming> _scenario;

    void Establish()
    {
        _identities = Substitute.For<IIdentityManager>();
        _eventStore = Substitute.For<IEventStore>();
        _eventStore.Identities.Returns(_identities);

        _scenario = new(new ServiceCollection().AddSingleton(_eventStore).BuildServiceProvider());
    }

    async Task Because() => await _scenario.Given
        .ForEventSource(AgentId.For(AgentPurposes.IssueTriage))
        .Events(new AgentConfigured(
            AgentPurposes.IssueTriage,
            (AgentName)"Pathfinder",
            (AgentDescription)"Reads a new or reopened issue and classifies what kind of work it is.",
            ModelTier.Premier,
            AIProviderId.NotSet,
            null,
            Harness.Pi,
            Effort.High));

    [Fact]
    async Task should_rename_the_identity_for_the_agent() =>
        await _identities.Received(1).Rename(AgentId.For(AgentPurposes.IssueTriage).Value, "Pathfinder");
}
