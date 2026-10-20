// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_the_tier_is_unsatisfied;

public class and_the_successful_catalog_is_empty : given.all_dependencies
{
    readonly AIProviderId _provider = AIProviderId.New();
    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_provider).Returns(new ConfiguredAIProvider(_provider, AIProviderType.Anthropic, "sk-ant-oat-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            ModelsDiscoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero)
        });
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_refuse_the_completion() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_name_the_missing_model() => _result.FailureReason.ShouldContain("retired-sonnet");
    [Fact] void should_not_call_the_vendor() => _anthropicClient.ReceivedCalls().Where(call => call.GetMethodInfo().Name == nameof(IAIProviderClient.Complete)).ShouldBeEmpty();
    [Fact] void should_not_record_a_rate_limit() => _commandPipeline.ReceivedCalls().ShouldBeEmpty();
}
