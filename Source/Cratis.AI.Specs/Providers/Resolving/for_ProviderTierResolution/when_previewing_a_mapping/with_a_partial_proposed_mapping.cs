// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.Resolving.for_ProviderTierResolution.when_previewing_a_mapping;

public class with_a_partial_proposed_mapping : Specification
{
    readonly AIProviderId _providerId = AIProviderId.New();
    readonly DateTimeOffset _discoveredAt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero);
    IEventStore _eventStore;
    ConfiguredAIProvider _provider;
    ProviderTierResolution[] _rows;

    void Establish()
    {
        _eventStore = Substitute.For<IEventStore>();
        var readModels = Substitute.For<IReadModels>();
        _eventStore.ReadModels.Returns(readModels);
        _provider = new(_providerId, AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new("retired-fast", "retired-balanced", "retired-powerful", "retired-premier"),
            AvailableModels = [new("claude-haiku-4-5"), new("claude-sonnet-4-5"), new("claude-opus-4-5")],
            ModelsDiscoveredAt = _discoveredAt,
            ModelDiscoveryFailure = "Last refresh failed"
        };
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId).Returns(_provider);
    }

    async Task Because() => _rows = (await ProviderTierResolution.PreviewProviderTierModels(
        _providerId, "claude-haiku-4-5", ModelName.NotSet, "missing-model", ModelName.NotSet, _eventStore)).ToArray();

    [Fact] void should_include_every_tier() => _rows.Select(row => row.Tier).ShouldContainOnly(Enum.GetValues<ModelTier>());
    [Fact] void should_use_the_proposed_model() => _rows.Single(row => row.Tier == ModelTier.Fast).Model.ShouldEqual((ModelName)"claude-haiku-4-5");
    [Fact] void should_identify_an_explicit_choice() => _rows.Single(row => row.Tier == ModelTier.Fast).Source.ShouldEqual(TierModelSource.Configured);
    [Fact] void should_clear_the_old_mapping_for_an_unset_tier() => _rows.Single(row => row.Tier == ModelTier.Balanced).Model.ShouldEqual((ModelName)"claude-sonnet-4-5");
    [Fact] void should_identify_a_derived_choice() => _rows.Single(row => row.Tier == ModelTier.Balanced).Source.ShouldEqual(TierModelSource.Derived);
    [Fact] void should_refuse_the_proposed_missing_model() => _rows.Single(row => row.Tier == ModelTier.Powerful).Source.ShouldEqual(TierModelSource.Unsatisfied);
    [Fact] void should_not_substitute_for_the_missing_model() => _rows.Single(row => row.Tier == ModelTier.Powerful).Model.ShouldEqual(ModelName.NotSet);
    [Fact] void should_explain_the_refusal() => _rows.Single(row => row.Tier == ModelTier.Powerful).Reason.ShouldContain("missing-model");
    [Fact] void should_identify_a_borrowed_choice() => _rows.Single(row => row.Tier == ModelTier.Premier).Source.ShouldEqual(TierModelSource.Borrowed);
    [Fact] void should_explain_borrowing() => _rows.Single(row => row.Tier == ModelTier.Premier).Reason.ShouldNotBeEmpty();
    [Fact] void should_preserve_discovery_time() => _rows.ShouldEachConformTo(row => row.ModelsDiscoveredAt == _discoveredAt);
    [Fact] void should_preserve_discovery_failure() => _rows.ShouldEachConformTo(row => row.ModelDiscoveryFailure == "Last refresh failed");
    [Fact] void should_not_mutate_the_current_mapping() => _provider.TierModels.Fast.ShouldEqual((ModelName)"retired-fast");
    [Fact] void should_not_clear_the_current_mapping() => _provider.TierModels.Balanced.ShouldEqual((ModelName)"retired-balanced");
    [Fact] void should_not_write_events() => _eventStore.ReceivedCalls().ShouldEachConformTo(call => call.GetMethodInfo().Name == "get_ReadModels");
}
