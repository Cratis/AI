// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_the_tier_is_unsatisfied;

public class and_the_agent_names_a_provider : given.all_dependencies
{
    readonly AIProviderId _provider = AIProviderId.New();
    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-sonnet-4-5")],
            ModelsDiscoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero)
        });
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_refuse_the_completion() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_retry_the_refusal() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_name_the_provider() => _result.FailureReason.ShouldContain(_provider.Value.ToString());
    [Fact] void should_name_the_tier() => _result.FailureReason.ShouldContain("Balanced");
    [Fact] void should_name_the_missing_model() => _result.FailureReason.ShouldContain("retired-sonnet");
    [Fact] void should_not_call_the_vendor() => _anthropicClient.ReceivedCalls().Where(call => call.GetMethodInfo().Name == nameof(IAIProviderClient.Complete)).ShouldBeEmpty();
    [Fact] void should_not_record_a_rate_limit() => _commandPipeline.ReceivedCalls().ShouldBeEmpty();
}
