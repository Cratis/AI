// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.given;

/// <summary>
/// Vendor clients that can take images, and the model discovering exactly them.
/// </summary>
public class image_clients : all_dependencies
{
    protected static readonly LanguageModelImage[] Images = [new(new byte[] { 1, 2, 3 }, "image/png")];

    protected IAIProviderImageClient _anthropicImageClient;
    protected IAIProviderImageClient _openAIImageClient;

    void Establish()
    {
        _anthropicImageClient = Substitute.For<IAIProviderImageClient>();
        _anthropicImageClient.Type.Returns(AIProviderType.Anthropic);
        _anthropicImageClient.Complete(Arg.Any<string>(), Arg.Any<IReadOnlyList<LanguageModelImage>>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Success("from-anthropic-images"));

        _openAIImageClient = Substitute.For<IAIProviderImageClient>();
        _openAIImageClient.Type.Returns(AIProviderType.OpenAI);
        _openAIImageClient.Complete(Arg.Any<string>(), Arg.Any<IReadOnlyList<LanguageModelImage>>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Success("from-openai-images"));

        _model = CreateModel(_anthropicImageClient, _openAIImageClient);
    }

    /// <summary>
    /// A configured Anthropic provider whose Balanced tier is the given model.
    /// </summary>
    /// <param name="id">The provider's identity.</param>
    /// <param name="model">The model the Balanced tier maps to.</param>
    /// <param name="type">The vendor.</param>
    /// <returns>The provider.</returns>
    protected static ConfiguredAIProvider ProviderWithModel(AIProviderId id, string model, AIProviderType type = AIProviderType.Anthropic) =>
        new(id, type, "sk-test")
        {
            TierModels = new(ModelName.NotSet, model, ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new(model)],
            ModelsDiscoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero)
        };
}
