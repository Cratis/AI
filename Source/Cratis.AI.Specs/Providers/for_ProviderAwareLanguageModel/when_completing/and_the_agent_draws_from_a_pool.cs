// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_agent_draws_from_a_pool : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _burnt = AIProviderId.New();
    static readonly AIProviderId _fresh = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_burnt), new(_fresh)]));
        ProviderIs(_burnt, new(_burnt, AIProviderType.Anthropic, "sk-ant-test"));
        ProviderIs(_fresh, new(_fresh, AIProviderType.OpenAI, "sk-openai-test"));
        RecordBurn(_burnt, 100_000);
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_answer_from_the_least_burnt_member() => _result.Text.ShouldEqual("from-openai");
    [Fact] void should_stamp_that_member_on_the_result() => _result.ProviderId.ShouldEqual(_fresh);

    [Fact]
    void should_use_the_tier_resolved_on_the_member() =>
        _openAIClient.Received(1).Complete("prompt", Arg.Any<ConfiguredAIProvider>(), "gpt-5.2", Arg.Any<Effort>(), Arg.Any<CancellationToken>());

    [Fact]
    void should_never_touch_the_burnt_member() =>
        _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);
}
