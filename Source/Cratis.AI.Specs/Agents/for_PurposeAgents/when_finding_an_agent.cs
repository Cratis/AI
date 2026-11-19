// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;

namespace Cratis.AI.Agents.for_PurposeAgents;

public class when_finding_an_agent : Specification
{
    PurposeAgents _agents;
    AgentDescriptor? _byPurpose;
    AgentDescriptor? _byId;

    void Establish() => _agents = new();

    void Because()
    {
        _byPurpose = _agents.FindByPurpose("Greeting");
        _byId = _agents.Find("greeting");
    }

    [Fact] void should_identify_the_agent_by_the_purpose() => _byPurpose!.Id.ShouldEqual(AgentId.For("Greeting"));
    [Fact] void should_name_the_agent_after_its_identity_for_a_purpose() => _byPurpose!.Name.Value.ShouldEqual("greeting");
    [Fact] void should_find_an_agent_by_its_identity() => _byId!.Id.ShouldEqual(new AgentId("greeting"));
    [Fact] void should_name_the_agent_after_its_identity() => _byId!.Name.Value.ShouldEqual("greeting");
}
