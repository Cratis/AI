// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing_with_images;

/// <summary>
/// A vendor client that only implements the text interface cannot send images, even for a model that
/// could read them - the images are refused, never dropped.
/// </summary>
public class and_the_client_cannot_take_images : given.image_clients
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, ProviderWithModel(_provider, "claude-sonnet-4-5"));
        _model = CreateModel(_anthropicClient);
    }

    async Task Because() => _result = await _model.Complete("prompt", Images, (LanguageModelPurpose)Purpose);

    [Fact] void should_refuse_the_completion() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_say_images_cannot_be_taken() => _result.FailureReason.ShouldContain("cannot take images");
    [Fact] void should_not_call_the_text_client() => _anthropicClient.ReceivedCalls().Where(call => call.GetMethodInfo().Name == nameof(IAIProviderClient.Complete)).ShouldBeEmpty();
}
