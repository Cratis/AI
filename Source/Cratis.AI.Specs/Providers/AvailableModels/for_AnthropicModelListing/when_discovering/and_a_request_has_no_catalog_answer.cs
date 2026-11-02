// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_discovering;

public class and_a_request_has_no_catalog_answer : Specification
{
    readonly IModelCatalogReader _reader = Substitute.For<IModelCatalogReader>();
    AIModelDiscoveryResult _result;

    async Task Because() => _result = await new AnthropicModelListing(_reader).Discover(
        new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, AIProviderApiKey.NotSet));

    [Fact] void should_not_treat_a_missing_credential_as_unavailable() => _result.Status.ShouldEqual(AIModelDiscoveryStatus.Failed);
    [Fact] void should_not_ask_the_provider() => _reader.DidNotReceive().Read(Arg.Any<string>(), Arg.Any<IEnumerable<KeyValuePair<string, string>>>());
}
