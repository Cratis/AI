// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_discovering;

public class and_an_alternate_credential_returns_a_catalog : Specification
{
    readonly IModelCatalogReader _reader = Substitute.For<IModelCatalogReader>();
    AIModelDiscoveryResult _result;

    void Establish() => _reader.Read(Arg.Any<string>(), Arg.Any<IEnumerable<KeyValuePair<string, string>>>()).Returns([new ModelName("fixture-model")]);

    async Task Because() => _result = await new AnthropicModelListing(_reader).Discover(
        new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat01-fixture") { UsageApiKey = "fixture-usage-key" });

    [Fact] void should_record_successful_discovery() => _result.Status.ShouldEqual(AIModelDiscoveryStatus.Discovered);
    [Fact] void should_return_the_alternate_catalog() => _result.Models.ShouldContainOnly(new ModelName("fixture-model"));

    [Fact]
    async Task should_send_the_alternate_key() =>
        await _reader.Received(1).Read(Arg.Any<string>(), Arg.Is<IEnumerable<KeyValuePair<string, string>>>(headers =>
            headers.Any(header => header.Key == "x-api-key" && header.Value == "fixture-usage-key")));
}
