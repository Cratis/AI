// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Skills;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Conversations;

/// <summary>
/// Where an agent defined by the caller runs - what <see cref="IAIChatClients.For(LanguageModels.LanguageModelPurpose, ChatAgentTarget)"/>
/// dispatches a chat to.
/// </summary>
/// <param name="Name">The agent's name.</param>
/// <param name="Description">What the agent is for.</param>
/// <param name="Tier">The capability tier the agent asks for.</param>
/// <param name="ProviderId">The provider the agent runs on, when it names one.</param>
/// <param name="PoolId">The provider pool the agent draws from, when it names one.</param>
/// <param name="Skills">The skills the agent has been given, when it has any.</param>
public record ChatAgentTarget(
    string Name,
    string Description,
    ModelTier Tier,
    AIProviderId? ProviderId,
    AIProviderPoolId? PoolId,
    IReadOnlyList<AgentSkill>? Skills = null);
