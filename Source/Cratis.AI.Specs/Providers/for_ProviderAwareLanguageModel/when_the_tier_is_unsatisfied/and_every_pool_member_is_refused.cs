// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_the_tier_is_unsatisfied;

public class and_every_pool_member_is_refused : given.all_dependencies
{
    readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    readonly AIProviderId _provider = AIProviderId.New();
    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));
        PoolIs(_pool, new(_pool, "Main pool", [new(_provider)]));
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-sonnet-4-5")]
        });
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_refuse_the_completion() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_retry_configuration() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_keep_the_refusal_reason() => _result.FailureReason.ShouldContain("retired-sonnet");
    [Fact] void should_not_remember_a_real_call_failure() => _recentProviderFailures.DidNotReceive().Record(_provider);
}
