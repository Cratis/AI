// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Agents;

/// <summary>
/// The default <see cref="IAIAgents"/>: one agent per purpose, identified by <see cref="AgentId.For"/>
/// and named after its identity. It is what <c>AddCratisAI</c> registers when the host does not
/// supply its own lookup with <c>WithAgents</c>.
/// </summary>
public sealed class PurposeAgents : IAIAgents
{
    /// <inheritdoc/>
    public AgentDescriptor? Find(AgentId id) => new(id, id.Value);

    /// <inheritdoc/>
    public AgentDescriptor? FindByPurpose(LanguageModelPurpose purpose) => Find(AgentId.For(purpose));
}
