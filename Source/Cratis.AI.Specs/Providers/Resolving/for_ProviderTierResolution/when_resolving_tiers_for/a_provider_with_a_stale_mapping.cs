// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.Resolving.for_ProviderTierResolution.when_resolving_tiers_for;

public class a_provider_with_a_stale_mapping : Specification
{
    readonly AIProviderId _providerId = AIProviderId.New();
    readonly DateTimeOffset _discoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero);
    IEventStore _eventStore;
    ProviderTierResolution[] _rows;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        var readModels = Substitute.For<IReadModels>();
        _eventStore.ReadModels.Returns(readModels);
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId).Returns(new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-haiku-4-5"), new("claude-sonnet-4-5"), new("claude-opus-4-5"), new("claude-fable-5-1")],
            ModelsDiscoveredAt = _discoveredAt
        });
    }

    async Task Because() => _rows = (await ProviderTierResolution.ResolveTiersFor(_providerId, _eventStore)).ToArray();

    [Fact] void should_return_one_row_per_tier() => _rows.Select(row => row.Tier).ShouldContainOnly(Enum.GetValues<ModelTier>());
    [Fact] void should_refuse_exactly_one_tier() => _rows.Count(row => row.Source == TierModelSource.Unsatisfied).ShouldEqual(1);
    [Fact] void should_not_substitute_for_the_stale_mapping() => _rows.Single(row => row.Tier == ModelTier.Balanced).Model.ShouldEqual(ModelName.NotSet);
    [Fact] void should_explain_the_refused_model() => _rows.Single(row => row.Tier == ModelTier.Balanced).Reason.ShouldContain("retired-sonnet");
    [Fact] void should_derive_the_other_tiers() => _rows.Where(row => row.Tier != ModelTier.Balanced).ShouldEachConformTo(row => row.Source == TierModelSource.Derived);
    [Fact] void should_report_the_last_successful_discovery() => _rows.ShouldEachConformTo(row => row.ModelsDiscoveredAt == _discoveredAt);
}
