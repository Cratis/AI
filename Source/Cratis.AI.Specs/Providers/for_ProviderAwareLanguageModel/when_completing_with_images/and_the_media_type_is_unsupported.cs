// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing_with_images;

public class and_the_media_type_is_unsupported : given.image_clients
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, ProviderWithModel(_provider, "claude-sonnet-4-5"));
    }

    async Task Because() => _result = await _model.Complete("prompt", [new(new byte[] { 1, 2, 3 }, "image/bmp")], (LanguageModelPurpose)Purpose);

    [Fact] void should_refuse_the_completion() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_name_the_media_type() => _result.FailureReason.ShouldContain("image/bmp");
    [Fact] void should_not_call_any_client() => _anthropicImageClient.ReceivedCalls().ShouldBeEmpty();
}
