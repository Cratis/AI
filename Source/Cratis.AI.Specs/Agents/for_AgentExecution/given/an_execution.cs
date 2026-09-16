// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Chronicle.Auditing;
using Cratis.Chronicle.Identities;
using NSubstitute;
using ChronicleIdentityProvider = Cratis.Chronicle.Identities.IIdentityProvider;

namespace Cratis.AI.Agents.for_AgentExecution.given;

/// <summary>
/// A real <see cref="Cratis.Chronicle.Identities.BaseIdentityProvider"/> and a real
/// <see cref="CausationManager"/>, exactly like production wires - the point being proven is that the
/// identity <see cref="AgentExecution"/> establishes reaches a second, independent provider instance
/// through the shared <c>AsyncLocal</c>, the same route Chronicle's real client reads it by.
/// </summary>
public class an_execution : Specification
{
    protected ChronicleIdentityProvider IdentityProvider;
    protected ICausationManager CausationManager;
    protected IAIAgents Agents;
    protected AgentExecution AgentExecution;

    protected static readonly AgentId KnownAgentId = new("triage");
    protected static readonly AgentName KnownAgentName = new("Scout");
    protected static readonly LanguageModels.LanguageModelPurpose KnownPurpose = new("triage-purpose");

    protected void Establish()
    {
        IdentityProvider = new BaseIdentityProvider();
        CausationManager = new CausationManager();

        Agents = Substitute.For<IAIAgents>();
        Agents.Find(KnownAgentId).Returns(new AgentDescriptor(KnownAgentId, KnownAgentName));
        Agents.FindByPurpose(KnownPurpose).Returns(new AgentDescriptor(KnownAgentId, KnownAgentName));

        AgentExecution = new AgentExecution(IdentityProvider, CausationManager, Agents);
    }
}
