// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.Resolving.for_ProviderTierResolution.when_resolving_tiers_for;

public class a_provider_without_a_catalog : Specification
{
    readonly AIProviderId _providerId = AIProviderId.New();
    IEventStore _eventStore;
    ProviderTierResolution[] _rows;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        var readModels = Substitute.For<IReadModels>();
        _eventStore.ReadModels.Returns(readModels);
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId).Returns(new ConfiguredAIProvider(_providerId, AIProviderType.OpenAICodex, "test-token")
        {
            TierModels = new(ModelName.NotSet, "hand-named-model", ModelName.NotSet, ModelName.NotSet),
            ModelDiscoveryFailure = "This provider publishes no catalog."
        });
    }

    async Task Because() => _rows = (await ProviderTierResolution.ResolveTiersFor(_providerId, _eventStore)).ToArray();

    [Fact] void should_keep_the_explicit_mapping() => _rows.Single(row => row.Tier == ModelTier.Balanced).Source.ShouldEqual(TierModelSource.Configured);
    [Fact] void should_show_why_the_mapping_is_unverified() => _rows.ShouldEachConformTo(row => row.ModelDiscoveryFailure == "This provider publishes no catalog.");
    [Fact] void should_not_invent_a_discovery_time() => _rows.ShouldEachConformTo(row => row.ModelsDiscoveredAt == default);
    [Fact] void should_refuse_the_unmapped_tiers() => _rows.Where(row => row.Tier != ModelTier.Balanced).ShouldEachConformTo(row => row.Source == TierModelSource.Unsatisfied);
}
