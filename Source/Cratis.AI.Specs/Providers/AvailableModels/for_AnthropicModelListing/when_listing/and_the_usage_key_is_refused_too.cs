// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_listing;

/// <summary>
/// When the second key is refused as well, the failure has to say so. Blaming the subscription token
/// for a refusal that came from the other key sends somebody to replace the wrong credential.
/// </summary>
public class and_the_usage_key_is_refused_too : Specification
{
    readonly IModelCatalogReader _reader = Substitute.For<IModelCatalogReader>();
    Exception _result;

    void Establish() =>
        _reader.Read(Arg.Any<string>(), Arg.Any<IEnumerable<KeyValuePair<string, string>>>())
            .Returns<IEnumerable<ModelName>>(_ => throw new ModelCatalogUnavailable("https://api.anthropic.com/v1/models", 401));

    async Task Because() => _result = await Cratis.Specifications.Catch.Exception(async () =>
        await new AnthropicModelListing(_reader).List(new ConfiguredAIProvider(
            AIProviderId.New(),
            AIProviderType.Anthropic,
            "sk-ant-oat01-subscription")
        {
            UsageApiKey = "sk-ant-admin01-organization",
        }));

    [Fact] void should_report_that_the_catalog_cannot_be_read() => _result.ShouldBeOfExactType<ModelCatalogUnavailable>();

    [Fact] void should_say_the_usage_key_was_refused_as_well() => _result.Message.ShouldContain("refused for it as well");

    [Fact] void should_carry_what_anthropic_answered() => _result.Message.ShouldContain("401");
}
