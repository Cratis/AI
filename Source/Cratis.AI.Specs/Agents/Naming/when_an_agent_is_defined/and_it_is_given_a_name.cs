// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Agents.Defining;
using Cratis.AI.Providers;
using Cratis.Chronicle;
using Cratis.Chronicle.Identities;
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Agents.Naming.when_an_agent_is_defined;

public class and_it_is_given_a_name : Specification
{
    static readonly AgentId _id = AgentId.For(AgentPurposes.IssueTriage);

    IIdentityManager _identities;
    ReactorScenario<AgentIdentityNaming> _scenario;

    void Establish()
    {
        _identities = Substitute.For<IIdentityManager>();
        var eventStore = Substitute.For<IEventStore>();
        eventStore.Identities.Returns(_identities);
        _scenario = new(new ServiceCollection().AddSingleton(eventStore).BuildServiceProvider());
    }

    async Task Because() => await _scenario.Given.ForEventSource(_id).Events(
        new AgentRoleConfigured(AgentPurposes.IssueTriage, (AgentName)"Pathfinder", (AgentDescription)"Classifies.", ModelTier.Premier, Harness.Pi, Effort.High),
        new AgentAssignedToProvider(AIProviderId.New()),
        new AgentAssignmentCleared(),
        new AgentConfigured(AgentPurposes.IssueTriage, (AgentName)"Wayfinder", (AgentDescription)"Classifies.", ModelTier.Premier, AIProviderId.NotSet, null, Harness.Pi, Effort.High));

    [Fact] async Task should_rename_for_the_role() => await _identities.Received(1).Rename(_id.Value, "Pathfinder");
    [Fact] async Task should_rename_for_the_legacy_configuration() => await _identities.Received(1).Rename(_id.Value, "Wayfinder");
    [Fact] async Task should_rename_nothing_else() => await _identities.Received(2).Rename(Arg.Any<string>(), Arg.Any<string>());
}
