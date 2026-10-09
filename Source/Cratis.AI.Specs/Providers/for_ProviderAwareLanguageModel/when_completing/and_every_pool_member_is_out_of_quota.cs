// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// When no member has quota left the completion fails with a reason that says the pool is exhausted
/// and names the providers tried, and it is not marked for the whole-call retry: a spent quota does
/// not come back within a retry's backoff (Cratis/AI#423).
/// </summary>
public class and_every_pool_member_is_out_of_quota : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_first), new(_second)]));
        ProviderIs(_first, new(_first, AIProviderType.Anthropic, "sk-ant-test"));
        ProviderIs(_second, new(_second, AIProviderType.OpenAI, "sk-openai-test"));

        _anthropicClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.QuotaExhausted("enforced_spend_limit_reached"));
        _openAIClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.QuotaExhausted("insufficient_quota"));
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_be_quota_exhausted() => _result.IsQuotaExhausted.ShouldBeTrue();
    [Fact] void should_not_be_marked_for_the_whole_call_retry() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_say_the_pool_is_exhausted() => _result.FailureReason.ShouldContain("the pool is exhausted");
    [Fact] void should_name_the_first_provider() => _result.FailureReason.ShouldContain(_first.ToString());
    [Fact] void should_name_the_second_provider() => _result.FailureReason.ShouldContain(_second.ToString());
}
