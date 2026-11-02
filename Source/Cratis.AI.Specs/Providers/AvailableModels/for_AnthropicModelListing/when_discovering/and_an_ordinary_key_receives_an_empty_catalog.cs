// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_discovering;

public class and_an_ordinary_key_receives_an_empty_catalog : Specification
{
    readonly IModelCatalogReader _reader = Substitute.For<IModelCatalogReader>();
    AIModelDiscoveryResult _result;

    void Establish() => _reader.Read(Arg.Any<string>(), Arg.Any<IEnumerable<KeyValuePair<string, string>>>()).Returns([]);

    async Task Because() => _result = await new AnthropicModelListing(_reader).Discover(
        new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "fixture-api-key"));

    [Fact] void should_record_successful_discovery() => _result.Status.ShouldEqual(AIModelDiscoveryStatus.Discovered);
    [Fact] void should_count_the_answer_as_a_success() => _result.Succeeded.ShouldBeTrue();
    [Fact] void should_keep_the_empty_catalog() => _result.Models.ShouldBeEmpty();
}
