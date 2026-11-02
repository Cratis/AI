// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_discovering;

public class and_subscription_discovery_is_unavailable : Specification
{
    readonly IModelCatalogReader _reader = Substitute.For<IModelCatalogReader>();
    AIModelDiscoveryResult _result;

    async Task Because() => _result = await new AnthropicModelListing(_reader).Discover(
        new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "  sk-ant-oat01-\nfixture  "));

    [Fact] void should_record_unavailable() => _result.Status.ShouldEqual(AIModelDiscoveryStatus.Unavailable);
    [Fact] void should_not_claim_success() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_invent_a_catalog() => _result.Models.ShouldBeEmpty();
    [Fact] void should_explain_manual_selection() => _result.Failure.ShouldContain("by hand");

    [Fact]
    void should_not_ask_a_provider_endpoint() =>
        _reader.DidNotReceive().Read(Arg.Any<string>(), Arg.Any<IEnumerable<KeyValuePair<string, string>>>());
}
