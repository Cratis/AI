// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.Resolving.for_ProviderTierResolution.when_previewing_a_mapping;

public class with_a_subscription_without_a_catalog : Specification
{
    readonly AIProviderId _providerId = AIProviderId.New();
    IEventStore _eventStore;
    ProviderTierResolution[] _rows;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        var readModels = Substitute.For<IReadModels>();
        _eventStore.ReadModels.Returns(readModels);
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId).Returns(new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, "sk-ant-oat01-test")
        {
            TierModels = new("old-fast", "old-balanced", "old-powerful", "old-premier")
        });
    }

    async Task Because() => _rows = (await ProviderTierResolution.PreviewProviderTierModels(
        _providerId, _eventStore)).ToArray();

    [Fact] void should_include_all_tiers() => _rows.Length.ShouldEqual(4);
    [Fact] void should_use_subscription_aliases_for_cleared_tiers() => _rows.ShouldEachConformTo(row => row.Source == TierModelSource.SubscriptionAlias);
    [Fact] void should_resolve_the_balanced_alias() => _rows.Single(row => row.Tier == ModelTier.Balanced).Model.ShouldEqual((ModelName)"sonnet");
}
