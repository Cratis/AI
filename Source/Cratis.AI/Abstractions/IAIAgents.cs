// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Abstractions;

/// <summary>
/// Looks up the identity of an agent, without the package owning the full agent model yet (that
/// reconciliation is plan Section 5.5). This is the seam <see cref="IAgentExecution"/> resolves an
/// agent through: Direct implements it over its own <c>Agents</c> catalog, Studio over
/// <c>Settings/Agents</c>.
/// </summary>
public interface IAIAgents
{
    /// <summary>
    /// Finds the agent by its identity.
    /// </summary>
    /// <param name="id">The <see cref="AgentId"/>.</param>
    /// <returns>The <see cref="AgentDescriptor"/>, or <see langword="null"/> when no known agent has that identity.</returns>
    AgentDescriptor? Find(AgentId id);

    /// <summary>
    /// Finds the agent that serves a purpose.
    /// </summary>
    /// <param name="purpose">The <see cref="LanguageModelPurpose"/>.</param>
    /// <returns>The <see cref="AgentDescriptor"/>, or <see langword="null"/> when no agent serves the purpose.</returns>
    AgentDescriptor? FindByPurpose(LanguageModelPurpose purpose);
}
