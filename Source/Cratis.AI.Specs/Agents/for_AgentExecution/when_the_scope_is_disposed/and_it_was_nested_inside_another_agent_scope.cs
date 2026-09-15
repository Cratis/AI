// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Chronicle.Identities;
using NSubstitute;
using ChronicleIdentity = Cratis.Chronicle.Identities.Identity;
using ChronicleIdentityProvider = Cratis.Chronicle.Identities.IIdentityProvider;

namespace Cratis.AI.Agents.for_AgentExecution.when_the_scope_is_disposed;

/// <summary>
/// Disposing an inner agent scope restores whichever identity was in force when it was entered - the
/// outer agent, not the system default - the same nesting guarantee Chronicle's own
/// <c>ICausationManager.BeginScope</c> gives for causation.
/// </summary>
public class and_it_was_nested_inside_another_agent_scope : given.an_execution
{
    static readonly AgentId _outerAgentId = new("outer");
    static readonly AgentName _outerAgentName = new("Outer");

    ChronicleIdentity _identityAfterInnerDisposed;

    void Establish() => Agents.Find(_outerAgentId).Returns(new AgentDescriptor(_outerAgentId, _outerAgentName));

    void Because()
    {
        using var outer = AgentExecution.As(_outerAgentId);

        using (AgentExecution.As(KnownAgentId))
        {
            // Inner scope active here - not asserted, the known-agent spec already covers it.
        }

        _identityAfterInnerDisposed = ((ChronicleIdentityProvider)new BaseIdentityProvider()).GetCurrent();
    }

    [Fact] void should_restore_the_outer_agents_identity() => _identityAfterInnerDisposed.Subject.ShouldEqual(_outerAgentId.Value);
}
