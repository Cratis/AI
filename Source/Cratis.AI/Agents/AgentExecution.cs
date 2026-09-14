// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.LanguageModels;
using Cratis.Chronicle.Auditing;
using ChronicleIdentity = Cratis.Chronicle.Identities.Identity;
using ChronicleIdentityProvider = Cratis.Chronicle.Identities.IIdentityProvider;

namespace Cratis.AI.Agents;

/// <summary>
/// The default <see cref="IAgentExecution"/> - opens a Chronicle identity scope and a causation scope
/// together, over the agent an <see cref="IAIAgents"/> lookup resolves.
/// </summary>
/// <param name="identityProvider">The Chronicle <see cref="ChronicleIdentityProvider"/> events get attributed through.</param>
/// <param name="causationManager">The <see cref="ICausationManager"/> the scope's causation is recorded under.</param>
/// <param name="agents">The <see cref="IAIAgents"/> lookup resolving an agent's identity and display name.</param>
public class AgentExecution(ChronicleIdentityProvider identityProvider, ICausationManager causationManager, IAIAgents agents) : IAgentExecution
{
    /// <inheritdoc/>
    public IDisposable As(AgentId agentId, IDictionary<string, string>? extraCausationProperties = null)
    {
        var agent = agents.Find(agentId);
        return Enter(agent, null, extraCausationProperties);
    }

    /// <inheritdoc/>
    public IDisposable As(LanguageModelPurpose purpose, IDictionary<string, string>? extraCausationProperties = null)
    {
        var agent = agents.FindByPurpose(purpose);
        return Enter(agent, purpose, extraCausationProperties);
    }

    /// <summary>
    /// Enters both scopes, falling back to a no-op scope when the agent is not known - the caller's
    /// work still has to run, it just cannot be attributed.
    /// </summary>
    /// <param name="agent">The resolved <see cref="AgentDescriptor"/>, or <see langword="null"/> when unknown.</param>
    /// <param name="purpose">The <see cref="LanguageModelPurpose"/> being served, if any.</param>
    /// <param name="extraCausationProperties">Additional causation properties to carry.</param>
    /// <returns>An <see cref="IDisposable"/> leaving both scopes, innermost first.</returns>
    IDisposable Enter(AgentDescriptor? agent, LanguageModelPurpose? purpose, IDictionary<string, string>? extraCausationProperties)
    {
        if (agent is null)
        {
            return NoOpScope.Instance;
        }

        var identity = AgentIdentity.For(agent.Id, agent.Name);
        var previousIdentity = identityProvider.GetCurrent();
        identityProvider.SetCurrentIdentity(identity);

        var causation = causationManager.BeginScope(
            AIAgentCausation.Type,
            AIAgentCausation.PropertiesFor(agent.Id, agent.Name, purpose, extra: extraCausationProperties));

        return new Scope(identityProvider, previousIdentity, causation);
    }

    sealed class Scope(ChronicleIdentityProvider identityProvider, ChronicleIdentity previousIdentity, IDisposable causation) : IDisposable
    {
        bool _disposed;

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            causation.Dispose();
            identityProvider.SetCurrentIdentity(previousIdentity);
        }
    }

    sealed class NoOpScope : IDisposable
    {
        public static readonly NoOpScope Instance = new();

        public void Dispose()
        {
        }
    }
}
