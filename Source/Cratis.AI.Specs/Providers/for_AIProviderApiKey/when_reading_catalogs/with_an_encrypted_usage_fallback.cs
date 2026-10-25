// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_reading_catalogs;

public class with_an_encrypted_usage_fallback : Specification
{
    IModelCatalogReader _reader = null!;
    Exception? _error;

    void Establish() => _reader = Substitute.For<IModelCatalogReader>();

    async Task Because() => _error = await Catch.Exception(() => new AnthropicModelListing(_reader).List(
        new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat01-valid") { UsageApiKey = "enc:v1:secret" }));

    [Fact] void should_require_reconfiguration() => _error.ShouldBeOfExactType<AIProviderRequiresReconfiguration>();
    [Fact] void should_not_send_the_usage_envelope_to_the_catalog() => _reader.ReceivedCalls().ShouldBeEmpty();
}
