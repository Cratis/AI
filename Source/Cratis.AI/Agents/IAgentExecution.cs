// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Agents;

/// <summary>
/// Runs a piece of work as one of the package's agents - the one call any agent-driven code path
/// makes so that every event it goes on to cause Chronicle appends is attributed to the agent
/// (<see cref="AgentIdentity"/>) and carries why the agent was acting (<see cref="AIAgentCausation"/>),
/// rather than reading as caused by an undifferentiated system.
/// </summary>
/// <remarks>
/// <para>
/// This is deliberately narrower than Direct's own <c>IAgentExecution</c>, which additionally opens an
/// Arc authorization scope (<c>ISystemExecution.AsSystem()</c>). Authorization is a product concern the
/// package does not own - Direct and Studio each decide what an agent is allowed to do. A consumer
/// composes this with its own authorization scope the same way Direct's original did, by wrapping this
/// interface rather than the package reimplementing it:
/// </para>
/// <code>
/// public IDisposable As(AgentId id) => new CompositeScope(systemExecution.AsSystem(), packageAgentExecution.As(id));
/// </code>
/// <para>
/// What the package does own, and what must not be split across two calls a consumer could get out of
/// sync: identity and causation are two separate Chronicle mechanisms (see
/// <see cref="AIAgentCausation"/>'s remarks) and this is the one call that opens both together.
/// </para>
/// </remarks>
public interface IAgentExecution
{
    /// <summary>
    /// Enters a scope executing as a specific agent.
    /// </summary>
    /// <param name="agentId">The <see cref="AgentId"/> of the agent doing the work.</param>
    /// <param name="extraCausationProperties">Additional causation properties to carry - a provider, a model, an effort.</param>
    /// <returns>An <see cref="IDisposable"/> that leaves the scope when disposed.</returns>
    /// <remarks>
    /// When <paramref name="agentId"/> is not a known agent (<see cref="IAIAgents.Find"/> returns
    /// <see langword="null"/>), this is a no-op scope: the work still runs, it just cannot be
    /// attributed. Silently doing nothing rather than throwing matches Direct's original behaviour -
    /// an unknown agent must never block the work it is trying to attribute.
    /// </remarks>
    IDisposable As(AgentId agentId, IDictionary<string, string>? extraCausationProperties = null);

    /// <summary>
    /// Enters a scope executing as the agent serving a purpose.
    /// </summary>
    /// <param name="purpose">The <see cref="LanguageModelPurpose"/> whose agent is doing the work.</param>
    /// <param name="extraCausationProperties">Additional causation properties to carry - a provider, a model, an effort.</param>
    /// <returns>An <see cref="IDisposable"/> that leaves the scope when disposed.</returns>
    IDisposable As(LanguageModelPurpose purpose, IDictionary<string, string>? extraCausationProperties = null);
}
