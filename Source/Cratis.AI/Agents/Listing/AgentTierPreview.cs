// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.AI.Providers.Resolving;

namespace Cratis.AI.Agents.Listing;

/// <summary>
/// The proposed tier's resolution on an agent's assigned provider or one member of its assigned pool.
/// Contains no credentials and does not change the agent, provider, or pool.
/// </summary>
/// <param name="AgentId">The agent being previewed.</param>
/// <param name="ProviderId">The provider, or the unset identity for an agent or pool that cannot be resolved.</param>
/// <param name="PoolId">The assigned pool, or the unset identity for a direct provider assignment.</param>
/// <param name="Resolution">The effective model, source, refusal or borrowing reason, and catalog status.</param>
[ReadModel]
[Passive]
public record AgentTierPreview(
    AgentId AgentId,
    AIProviderId ProviderId,
    AIProviderPoolId PoolId,
    ProviderTierResolution Resolution)
{
    /// <summary>
    /// Explains the proposed tier on every assigned provider without applying ConfigureAgent.
    /// A pool includes every member, even missing providers and members whose tier is refused.
    /// This previews model resolution only, not entitlement, capacity, or runtime selection order.
    /// </summary>
    /// <param name="agentId">The configured agent.</param>
    /// <param name="tier">The proposed tier.</param>
    /// <param name="readModels">The configured agent, pool, and providers.</param>
    /// <returns>One row per assigned provider, or an explicit refusal if the assignment cannot be resolved.</returns>
    public static async Task<IEnumerable<AgentTierPreview>> PreviewAgentTier(AgentId agentId, ModelTier tier, IReadModels readModels)
    {
        var agent = agentId == AgentId.NotSet ? null : await readModels.GetInstanceById<Agent>((EventSourceId)agentId);
        if (agent is null)
        {
            return [AgentTierPreviews.Refused(agentId, AIProviderPoolId.NotSet, tier, $"Agent {agentId} could not be found.")];
        }

        var poolId = agent.PoolId ?? AIProviderPoolId.NotSet;
        AIProviderId[] providerIds;
        if (poolId != AIProviderPoolId.NotSet)
        {
            var pool = await readModels.GetInstanceById<AIProviderPool>((EventSourceId)poolId);
            if (pool is null)
            {
                return [AgentTierPreviews.Refused(agentId, poolId, tier, $"AI provider pool {poolId} could not be found.")];
            }

            providerIds = pool.Members?.Select(member => member.ProviderId).ToArray() ?? [];
            if (providerIds.Length == 0)
            {
                return [AgentTierPreviews.Refused(agentId, poolId, tier, $"AI provider pool {poolId} has no members.")];
            }
        }
        else if (agent.ProviderId is { } providerId && providerId != AIProviderId.NotSet)
        {
            providerIds = [providerId];
        }
        else
        {
            return [AgentTierPreviews.Refused(agentId, poolId, tier, $"Agent {agentId} has no AI provider or pool configured.")];
        }

        var rows = new List<AgentTierPreview>();
        foreach (var providerId in providerIds)
        {
            var provider = providerId == AIProviderId.NotSet ? null : await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
            rows.Add(new(agentId, providerId, poolId, ProviderTierResolutions.Resolve(providerId, provider, tier)));
        }

        return rows.ToArray();
    }
}

/// <summary>
/// Builds refusal rows for assignments that cannot name any provider.
/// </summary>
internal static class AgentTierPreviews
{
    /// <summary>
    /// Keeps an unresolved assignment visible in the preview.
    /// </summary>
    /// <param name="agentId">The requested agent.</param>
    /// <param name="poolId">The assigned pool, or its unset identity.</param>
    /// <param name="tier">The proposed tier.</param>
    /// <param name="reason">Why the assignment cannot be resolved.</param>
    /// <returns>A refusal without a provider or usable model.</returns>
    internal static AgentTierPreview Refused(AgentId agentId, AIProviderPoolId poolId, ModelTier tier, string reason) =>
        new(agentId, AIProviderId.NotSet, poolId, new(tier, ModelName.NotSet, TierModelSource.Unsatisfied, reason, string.Empty, default));
}
