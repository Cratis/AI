// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Auditing;
using Cratis.Chronicle.Identities;
using ChronicleIdentityProvider = Cratis.Chronicle.Identities.IIdentityProvider;

namespace Cratis.AI.Agents.for_AgentExecution.when_executing_as_an_agent;

/// <summary>
/// Both mechanisms an agent's work needs to be attributed correctly are opened by the one call: the
/// Chronicle identity its events are caused by, and the causation entry describing why.
/// </summary>
public class and_the_agent_is_known : given.an_execution
{
    Identity _identityDuring;
    IReadOnlyList<Causation> _causationChainDuring;

    void Because()
    {
        using var scope = AgentExecution.As(KnownAgentId);

        // Read through a provider instance of its own, proving the identity reaches the shared
        // AsyncLocal the Chronicle client's own provider reads by - the same thing Direct's own
        // equivalent spec proves for its AgentExecution.
        _identityDuring = ((ChronicleIdentityProvider)new BaseIdentityProvider()).GetCurrent();
        _causationChainDuring = CausationManager.GetCurrentChain();
    }

    [Fact] void should_cause_events_as_the_agent_subject() => _identityDuring.Subject.ShouldEqual(KnownAgentId.Value);
    [Fact] void should_cause_events_as_the_agent_name() => _identityDuring.Name.ShouldEqual(KnownAgentName.Value);
    [Fact] void should_record_agent_work_causation() => _causationChainDuring[^1].Type.ShouldEqual(AIAgentCausation.Type);
    [Fact] void should_carry_the_agent_id_in_causation() => _causationChainDuring[^1].Properties[AIAgentCausation.AgentIdProperty].ShouldEqual(KnownAgentId.Value);
}
