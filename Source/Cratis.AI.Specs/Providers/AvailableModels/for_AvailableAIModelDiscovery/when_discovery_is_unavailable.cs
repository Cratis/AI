// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.AvailableModels.for_AvailableAIModelDiscovery;

/// <summary>
/// An unavailable discovery was recorded as a failed one before discovery was typed, and the query
/// answers both the same way: the last published catalog, or the reason when there is none.
/// </summary>
public class when_discovery_is_unavailable : Specification
{
    static readonly DateTimeOffset _at = DateTimeOffset.Parse("2026-09-20T10:00:00Z");
    AvailableAIModelDiscovery[] _withCatalog;
    AvailableAIModelDiscovery[] _failedWithCatalog;
    AvailableAIModelDiscovery[] _withoutCatalog;

    async Task Because()
    {
        var provider = new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "fixture-api-key")
        {
            AvailableModels = [new("historical-model")],
            ModelsDiscoveredAt = _at,
            ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable,
            ModelDiscoveryFailure = "fixture capability limitation"
        };
        _withCatalog = await Discover(provider);
        _failedWithCatalog = await Discover(provider with { ModelDiscoveryStatus = AIModelDiscoveryStatus.Failed });
        _withoutCatalog = await Discover(provider with { AvailableModels = [] });
    }

    static async Task<AvailableAIModelDiscovery[]> Discover(ConfiguredAIProvider provider)
    {
        var readModels = Substitute.For<IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider.Id).Returns(provider);
        var store = Substitute.For<IEventStore>();
        store.ReadModels.Returns(readModels);
        return [.. await AvailableAIModelDiscovery.DiscoverModelsFor(provider.Id, store)];
    }

    [Fact] void should_list_the_last_published_catalog() => _withCatalog.Single().Id.ShouldEqual(new ModelName("historical-model"));
    [Fact] void should_answer_as_a_failed_discovery_does() => Row(_withCatalog.Single()).ShouldEqual(Row(_failedWithCatalog.Single()));

    static (ModelName, bool, string, DateTimeOffset) Row(AvailableAIModelDiscovery row) => (row.Id, row.HasModel, row.Failure, row.DiscoveredAt);
    [Fact] void should_explain_unavailability_without_a_catalog() => _withoutCatalog.Single().Failure.ShouldEqual("fixture capability limitation");
    [Fact] void should_not_list_a_model_without_a_catalog() => _withoutCatalog.Single().HasModel.ShouldBeFalse();
    [Fact] void should_keep_the_last_successful_timestamp() => _withoutCatalog.Single().DiscoveredAt.ShouldEqual(_at);
}
