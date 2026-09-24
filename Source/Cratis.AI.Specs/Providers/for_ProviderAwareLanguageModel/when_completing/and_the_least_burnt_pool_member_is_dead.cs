// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_least_burnt_pool_member_is_dead : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _dead = AIProviderId.New();
    static readonly AIProviderId _alive = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_dead), new(_alive)]));

        // The dead member has burnt nothing, so the least-burnt pick lands on it first - but its
        // provider is gone (removed), which must skip to the next member rather than sink the call.
        ProviderIs(_dead, null);
        ProviderIs(_alive, new(_alive, AIProviderType.OpenAI, "sk-openai-test"));
        RecordBurn(_alive, 100_000);
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_answer_from_the_surviving_member() => _result.Text.ShouldEqual("from-openai");
    [Fact] void should_stamp_the_surviving_member_on_the_result() => _result.ProviderId.ShouldEqual(_alive);
}
