// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing_with_images;

public class and_the_model_supports_vision : given.image_clients
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, ProviderWithModel(_provider, "claude-sonnet-4-5"));
    }

    async Task Because() => _result = await _model.Complete("prompt", Images, (LanguageModelPurpose)Purpose);

    [Fact] void should_answer_from_the_image_client() => _result.Text.ShouldEqual("from-anthropic-images");
    [Fact] void should_stamp_the_provider_on_the_result() => _result.ProviderId.ShouldEqual(_provider);

    [Fact]
    void should_pass_the_images_to_the_client() =>
        _anthropicImageClient.Received(1).Complete("prompt", Images, Arg.Any<ConfiguredAIProvider>(), "claude-sonnet-4-5", Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
