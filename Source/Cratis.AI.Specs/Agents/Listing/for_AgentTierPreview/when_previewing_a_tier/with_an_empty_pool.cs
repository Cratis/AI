// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Agents.Listing.for_AgentTierPreview.when_previewing_a_tier;

public class with_an_empty_pool : given.an_agent
{
    void Establish()
    {
        _readModels.GetInstanceById<Agent>((EventSourceId)_agentId).Returns(_agent with { ProviderId = null, PoolId = _poolId });
        _readModels.GetInstanceById<AIProviderPool>((EventSourceId)_poolId).Returns(new AIProviderPool(_poolId, "Empty pool", []));
    }

    async Task Because() => _rows = (await AgentTierPreview.PreviewAgentTier(_agentId, ModelTier.Fast, _readModels)).ToArray();

    [Fact] void should_refuse_instead_of_returning_an_empty_preview() => _rows.Single().Resolution.Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_identify_the_pool() => _rows.Single().PoolId.ShouldEqual(_poolId);
    [Fact] void should_explain_that_the_pool_is_empty() => _rows.Single().Resolution.Reason.ShouldContain("has no members");
}
