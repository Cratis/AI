// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.given;

public class a_subscription_with_an_alternate_catalog_credential : for_ModelCatalogReader.given.a_reader_with_a_stubbed_endpoint
{
    protected AvailableAIModels _models;
    protected AIProviderId _providerId;

    void Establish()
    {
        var provider = new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat01-fixture")
        {
            UsageApiKey = "fixture-usage-key"
        };
        var readModels = Substitute.For<Cratis.Chronicle.ReadModels.IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider.Id).Returns(provider);
        var store = Substitute.For<Cratis.Chronicle.IEventStore>();
        store.ReadModels.Returns(readModels);
        _models = new(store, new Cratis.Types.KnownInstancesOf<ICanListAvailableModels>(new AnthropicModelListing(_reader)), Substitute.For<ILogger<AvailableAIModels>>());
        _providerId = provider.Id;
    }
}
