// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.for_ProviderAwareLanguageModel.given;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_provider_lacks_the_required_capability : all_dependencies
{
    readonly AIProviderId _providerId = AIProviderId.New();
    LanguageModelResult _result;

    void Establish()
    {
        var agent = new Agent(
            AgentId.For((LanguageModelPurpose)Purpose),
            (LanguageModelPurpose)Purpose,
            (AgentName)"Scout",
            (AgentDescription)"Triages issues",
            ModelTier.Balanced,
            _providerId,
            null);
        AgentIs(agent);
        ProviderIs(_providerId, new ConfiguredAIProvider(
            _providerId,
            AIProviderType.Anthropic,
            (AIProviderApiKey)"secret"));
        _compatibility.Supports((LanguageModelPurpose)Purpose, AIProviderType.Anthropic).Returns(false);
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_fail() => _result.Succeeded.ShouldBeFalse();
    [Fact] async Task should_not_call_the_provider() =>
        await _anthropicClient.DidNotReceive().Complete(
            Arg.Any<string>(),
            Arg.Any<ConfiguredAIProvider>(),
            Arg.Any<ModelName>(),
            Arg.Any<Effort>(),
            Arg.Any<CancellationToken>());
}
