// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Providers.AvailableModels.for_AvailableAIModels.when_discovering;

/// <summary>
/// Verifies the whole chain: the provider is resolved, its key - stored protected at rest - reaches
/// the vendor listing revealed at the moment it is spent, and the listing's answer comes back as-is.
/// </summary>
public class and_a_listing_serves_the_provider_type : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    AIModelDiscoveryResult _result;

    void Establish() =>
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test"));

    async Task Because() => _result = await _availableModels.Discover(_provider);

    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();

    [Fact] void should_answer_with_the_listings_models() => _result.Models.ShouldContainOnly(new ModelName("claude-sonnet-4-5"), new ModelName("claude-haiku-4-5"));

    [Fact]
    void should_hand_the_listing_the_revealed_key() =>
        _anthropicListing.Received(1).List(Arg.Is<ConfiguredAIProvider>(provider => provider.ApiKey == new AIProviderApiKey("sk-ant-test")));
}
