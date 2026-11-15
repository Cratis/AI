// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing_with_images;

public class and_the_model_lacks_vision : given.image_clients
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, ProviderWithModel(_provider, "llama-3-70b"));
    }

    async Task Because() => _result = await _model.Complete("prompt", Images, (LanguageModelPurpose)Purpose);

    [Fact] void should_refuse_the_completion() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_retry_the_refusal() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_name_the_model() => _result.FailureReason.ShouldContain("llama-3-70b");
    [Fact] void should_name_the_missing_capability() => _result.FailureReason.ShouldContain("Vision");
    [Fact] void should_not_attribute_the_refusal_to_the_provider() => _result.ProviderId.ShouldBeNull();
    [Fact] void should_not_call_the_client_with_images() => _anthropicImageClient.ReceivedCalls().Where(call => call.GetMethodInfo().Name == nameof(IAIProviderClient.Complete)).ShouldBeEmpty();
    [Fact] void should_log_the_refusal() => _logger.WarningsAndAbove.ShouldContain(message => message.Contains("cannot take the images"));
}
