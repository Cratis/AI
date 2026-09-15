// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Usage;
using Cratis.Chronicle.Auditing;

namespace Cratis.AI.Agents;

/// <summary>
/// The <see cref="CausationType"/> recorded for agent-caused work, so an event's causation chain says
/// which agent, and for what purpose and session, produced it - not just who it is attributed to.
/// Chronicle's <see cref="ICausationManager"/> already exists precisely for this (see
/// <c>Cratis.Chronicle.AspNetCore.Auditing.CausationMiddleware</c> for the HTTP-request equivalent);
/// this is the agent-work counterpart, generalized from Direct's own <c>Common.AgentWorkCausation</c>
/// (plan Section 5.1 / identity design note).
/// </summary>
/// <remarks>
/// Identity (<see cref="AgentIdentity"/>) answers <em>who</em>; causation answers <em>why</em>, and the
/// two are deliberately separate mechanisms in Chronicle - an identity is a single value attributed to
/// an appended event, a causation is a chain of context leading up to it. <see cref="IAgentExecution"/>
/// opens both together so a call site cannot establish one and forget the other.
/// </remarks>
public static class AIAgentCausation
{
    /// <summary>
    /// The property key for the agent's identity.
    /// </summary>
    public const string AgentIdProperty = "agentId";

    /// <summary>
    /// The property key for the agent's display name.
    /// </summary>
    public const string AgentNameProperty = "agentName";

    /// <summary>
    /// The property key for the purpose the agent was invoked for.
    /// </summary>
    public const string PurposeProperty = "purpose";

    /// <summary>
    /// The property key for the agent session the work belongs to, when one has been established.
    /// </summary>
    public const string SessionProperty = "session";

    /// <summary>
    /// The <see cref="CausationType"/> for agent-caused work.
    /// </summary>
    public static readonly CausationType Type = new("Cratis.AI.AgentWork");

    /// <summary>
    /// Builds the base causation properties for a unit of agent work. Callers with extra context to
    /// carry (a provider, a model, an effort - concepts that live above this abstraction layer) pass
    /// them in <paramref name="extra"/> and they are merged in, extra winning on key collision.
    /// </summary>
    /// <param name="agentId">The acting agent's <see cref="AgentId"/>.</param>
    /// <param name="agentName">The acting agent's <see cref="AgentName"/>.</param>
    /// <param name="purpose">The <see cref="LanguageModelPurpose"/> the agent is serving, if any.</param>
    /// <param name="session">The <see cref="AgentSessionId"/> the work belongs to, if one has been established.</param>
    /// <param name="extra">Additional properties to merge in.</param>
    /// <returns>The causation properties.</returns>
    public static IDictionary<string, string> PropertiesFor(
        AgentId agentId,
        AgentName agentName,
        LanguageModelPurpose? purpose = null,
        AgentSessionId? session = null,
        IDictionary<string, string>? extra = null)
    {
        var properties = new Dictionary<string, string>
        {
            { AgentIdProperty, agentId.Value },
            { AgentNameProperty, agentName.Value },
        };

        if (purpose is not null && purpose != LanguageModelPurpose.NotSet)
        {
            properties[PurposeProperty] = purpose.Value;
        }

        if (session is not null && session != AgentSessionId.NotSet)
        {
            properties[SessionProperty] = session.Value;
        }

        if (extra is not null)
        {
            foreach (var (key, value) in extra)
            {
                properties[key] = value;
            }
        }

        return properties;
    }
}
