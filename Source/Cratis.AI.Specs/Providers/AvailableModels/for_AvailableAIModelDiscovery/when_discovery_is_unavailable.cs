// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.AvailableModels.for_AvailableAIModelDiscovery;

public class when_discovery_is_unavailable : Specification
{
    IEnumerable<AvailableAIModelDiscovery> _rows;

    async Task Because()
    {
        var provider = new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "fixture-api-key")
        {
            AvailableModels = [new("historical-model")],
            ModelsDiscoveredAt = DateTimeOffset.Parse("2026-09-20T10:00:00Z"),
            ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable,
            ModelDiscoveryFailure = "fixture capability limitation"
        };
        var readModels = Substitute.For<IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider.Id).Returns(provider);
        var store = Substitute.For<IEventStore>();
        store.ReadModels.Returns(readModels);
        _rows = await AvailableAIModelDiscovery.DiscoverModelsFor(provider.Id, store);
    }

    [Fact] void should_return_only_a_reason_bearing_sentinel() => _rows.Count().ShouldEqual(1);
    [Fact] void should_not_return_a_stale_catalog_model() => _rows.Single().HasModel.ShouldBeFalse();
    [Fact] void should_explain_unavailability() => _rows.Single().Failure.ShouldEqual("fixture capability limitation");
    [Fact] void should_keep_the_last_successful_timestamp() => _rows.Single().DiscoveredAt.ShouldEqual(DateTimeOffset.Parse("2026-09-20T10:00:00Z"));
}
