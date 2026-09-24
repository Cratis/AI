// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// Verifies the point-of-use reveal: a key stored protected by the tenant's Vault-held encryption
/// key reaches the vendor client as the usable plaintext credential - revealed at the moment it is
/// spent and nowhere earlier.
/// </summary>
public class and_a_named_provider_serves_the_purpose : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test"));
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_answer_from_the_named_provider() => _result.Text.ShouldEqual("from-anthropic");

    [Fact]
    void should_hand_the_client_the_revealed_key() =>
        _anthropicClient.Received(1).Complete("prompt", Arg.Is<ConfiguredAIProvider>(provider => provider.ApiKey == new AIProviderApiKey("sk-ant-test")), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>());
}
