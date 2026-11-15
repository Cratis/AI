// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing_with_images;

/// <summary>
/// An empty image list needs no vision: it completes through the text path, even on a model and a
/// client that could not take images.
/// </summary>
public class and_no_images_are_given : given.image_clients
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, ProviderWithModel(_provider, "llama-3-70b"));
        _model = CreateModel(_anthropicClient);
    }

    async Task Because() => _result = await _model.Complete("prompt", [], (LanguageModelPurpose)Purpose);

    [Fact] void should_complete_through_the_text_path() => _result.Text.ShouldEqual("from-anthropic");
}
