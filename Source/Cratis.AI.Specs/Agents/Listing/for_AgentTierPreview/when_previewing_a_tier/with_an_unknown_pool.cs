// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Agents.Listing.for_AgentTierPreview.when_previewing_a_tier;

public class with_an_unknown_pool : given.an_agent
{
    void Establish()
    {
        _readModels.GetInstanceById<Agent>((EventSourceId)_agentId).Returns(_agent with { ProviderId = null, PoolId = _poolId });
        _readModels.GetInstanceById<AIProviderPool>((EventSourceId)_poolId).Returns((AIProviderPool)null!);
    }

    async Task Because() => _rows = (await AgentTierPreview.PreviewAgentTier(_agentId, ModelTier.Fast, _readModels)).ToArray();

    [Fact] void should_return_an_explicit_refusal() => _rows.Single().Resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_explain_the_missing_pool() => _rows.Single().Resolution.Reason.ShouldContain($"pool {_poolId} could not be found");
}
