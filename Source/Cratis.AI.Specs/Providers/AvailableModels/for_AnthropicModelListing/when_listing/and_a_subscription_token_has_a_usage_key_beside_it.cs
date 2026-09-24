// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_listing;

/// <summary>
/// A Claude subscription token cannot read the model list, but the usage reporting key configured
/// beside it is an ordinary organization key as far as Anthropic is concerned. Asking with it is
/// worth a try before telling somebody to type four model names by hand.
/// </summary>
public class and_a_subscription_token_has_a_usage_key_beside_it : Specification
{
    readonly IModelCatalogReader _reader = Substitute.For<IModelCatalogReader>();
    IEnumerable<KeyValuePair<string, string>> _headers;
    IEnumerable<ModelName> _result;

    void Establish() =>
        _reader.Read(Arg.Any<string>(), Arg.Do<IEnumerable<KeyValuePair<string, string>>>(headers => _headers = headers))
            .Returns([new ModelName("claude-sonnet-4-5")]);

    async Task Because() => _result = await new AnthropicModelListing(_reader).List(new ConfiguredAIProvider(
        AIProviderId.New(),
        AIProviderType.Anthropic,
        "sk-ant-oat01-subscription")
    {
        UsageApiKey = "sk-ant-admin01-organization",
    });

    [Fact] void should_answer_with_what_anthropic_listed() => _result.ShouldContainOnly(new ModelName("claude-sonnet-4-5"));

    [Fact] void should_ask_with_the_usage_key() =>
        _headers.ShouldContain(new KeyValuePair<string, string>("x-api-key", "sk-ant-admin01-organization"));

    [Fact] void should_not_ask_with_the_subscription_token() =>
        _headers.Any(header => header.Value.Contains("oat01")).ShouldBeFalse();
}
