// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_the_tier_is_unsatisfied;

public class and_the_agent_names_a_pool : given.all_dependencies
{
    readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    readonly AIProviderId _first = AIProviderId.New();
    readonly AIProviderId _second = AIProviderId.New();
    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_first), new(_second)]));
        ProviderIs(_first, new(_first, AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-sonnet-4-5")]
        });
        ProviderIs(_second, new(_second, AIProviderType.OpenAI, "sk-openai-test"));
        _anthropicClient.ClearReceivedCalls();
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_serve_from_the_next_member() => _result.Text.ShouldEqual("from-openai");
    [Fact] void should_not_call_the_refused_vendor() => _anthropicClient.ReceivedCalls().Where(call => call.GetMethodInfo().Name == nameof(IAIProviderClient.Complete)).ShouldBeEmpty();
    [Fact] void should_not_record_a_rate_limit() => _commandPipeline.ReceivedCalls().ShouldBeEmpty();
}
