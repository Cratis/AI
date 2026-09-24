// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_listing;

/// <summary>
/// A Claude subscription token authenticates Claude Code but not Anthropic's model-list endpoint.
/// This used to answer with four model names Direct carried hardcoded - one of which named a model
/// that does not exist - presented as though Anthropic had published them. Saying it cannot be asked
/// is the honest answer, and the one an operator can act on (#1187).
/// </summary>
public class and_the_provider_uses_a_claude_setup_token : Specification
{
    readonly IModelCatalogReader _reader = Substitute.For<IModelCatalogReader>();
    Exception _result;

    async Task Because() => _result = await Cratis.Specifications.Catch.Exception(async () =>
    {
        var listing = new AnthropicModelListing(_reader);
        await listing.List(new ConfiguredAIProvider(
            AIProviderId.New(),
            AIProviderType.Anthropic,
            "sk-ant-oat01-subscription"));
    });

    [Fact] void should_report_that_the_catalog_cannot_be_read() => _result.ShouldBeOfExactType<ModelCatalogUnavailable>();

    [Fact] void should_say_the_models_must_be_named_by_hand() => _result.Message.ShouldContain("by hand");

    [Fact]
    async Task should_not_call_the_model_list_endpoint() =>
        await _reader.DidNotReceive().Read(Arg.Any<string>(), Arg.Any<IEnumerable<KeyValuePair<string, string>>>());
}
