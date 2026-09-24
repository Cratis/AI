// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// A provider resolves, but no discovered <see cref="IAIProviderClient"/> serves its vendor - the
/// harness only wires up an Anthropic and an OpenAI client, so a provider of a third vendor type
/// exercises exactly the gap a missing/undiscovered vendor client would leave in production.
/// </summary>
public class and_the_provider_vendor_has_no_client : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    LanguageModelResult _result;

    void Establish()
    {
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null));
        ProviderIs(_provider, new(_provider, AIProviderType.AzureOpenAI, "sk-test") { Endpoint = "https://example.openai.azure.com" });
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();

    [Fact]
    void should_say_the_configured_provider_could_not_serve_it() =>
        _result.FailureReason.ShouldContain("could not serve");

    [Fact]
    void should_log_that_no_client_serves_the_vendor() =>
        _logger.WarningsAndAbove.Any(message => message.Contains(_provider.Value.ToString()) && message.Contains("AzureOpenAI")).ShouldBeTrue();
}
