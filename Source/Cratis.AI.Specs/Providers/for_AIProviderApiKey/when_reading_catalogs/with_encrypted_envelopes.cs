// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_reading_catalogs;

public class with_encrypted_envelopes : Specification
{
    IModelCatalogReader _reader = null!;
    ICanListAvailableModels[] _listings = [];
    Exception?[] _errors = [];

    void Establish()
    {
        _reader = Substitute.For<IModelCatalogReader>();
        _listings = [new AnthropicModelListing(_reader), new OpenAIModelListing(_reader), new AzureOpenAIModelListing(_reader), new OpenAICompatibleModelListing(_reader), new ZAIModelListing(_reader)];
    }

    async Task Because() => _errors = await Task.WhenAll(_listings.SelectMany(listing => new[] { "enc:v1:secret", "enc:v99:secret" }.Select(envelope =>
        Catch.Exception(() => listing.List(new ConfiguredAIProvider(AIProviderId.New(), listing.Type, envelope) { Endpoint = "https://example.test" })))));

    [Fact] void should_refuse_every_encrypted_envelope() => _errors.All(error => error is AIProviderRequiresReconfiguration).ShouldBeTrue();
    [Fact] void should_not_call_the_catalog_reader() => _reader.ReceivedCalls().ShouldBeEmpty();
}
