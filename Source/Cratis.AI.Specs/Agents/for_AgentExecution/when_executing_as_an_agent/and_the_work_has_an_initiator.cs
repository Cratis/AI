// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.Chronicle.Auditing;
using Cratis.Chronicle.Identities;

namespace Cratis.AI.Agents.for_AgentExecution.when_executing_as_an_agent;

public class and_the_work_has_an_initiator : given.an_execution
{
    WorkInitiation _initiation;
    IReadOnlyList<Causation> _chain;
    Identity _identity;
    WorkInitiator _during;

    void Establish()
    {
        _initiation = new();
        AgentExecution = new(IdentityProvider, CausationManager, Agents, _initiation);
    }

    void Because()
    {
        using var journey = _initiation.Begin(WorkInitiator.By((TeamMemberId)"alice"));
        using var agent = AgentExecution.As(KnownAgentId);
        _chain = CausationManager.GetCurrentChain();
        _identity = IdentityProvider.GetCurrent();
        _during = _initiation.Current;
    }

    [Fact] void should_keep_the_agent_as_the_actor() => _identity.Subject.ShouldEqual(KnownAgentId.Value);
    [Fact] void should_attribute_the_journey_separately() => _chain[^1].Properties[AIAgentCausation.InitiatorProperty].ShouldEqual("alice");
    [Fact] void should_not_replace_the_initiator() => _during.Member.ShouldEqual((TeamMemberId)"alice");
}
