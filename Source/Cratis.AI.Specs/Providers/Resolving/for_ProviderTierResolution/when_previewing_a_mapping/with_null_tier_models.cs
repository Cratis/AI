// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.Resolving.for_ProviderTierResolution.when_previewing_a_mapping;

public class with_null_tier_models : Specification
{
    readonly AIProviderId _providerId = AIProviderId.New();
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
            TierModels = new("old-fast", "old-balanced", "old-powerful", "old-premier"),
            AvailableModels = [new("claude-haiku-4-5"), new("claude-sonnet-4-5"), new("claude-opus-4-5")]
        };
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId).Returns(_provider);
    }

    async Task Because() => _rows = (await ProviderTierResolution.PreviewProviderTierModels(
        _providerId, _eventStore, null, null, null, null)).ToArray();

    [Fact] void should_include_all_tiers() => _rows.Length.ShouldEqual(4);
    [Fact] void should_derive_fast_instead_of_preserving_the_old_mapping() => _rows.Single(row => row.Tier == ModelTier.Fast).Model.ShouldEqual((ModelName)"claude-haiku-4-5");
    [Fact] void should_derive_balanced_instead_of_preserving_the_old_mapping() => _rows.Single(row => row.Tier == ModelTier.Balanced).Model.ShouldEqual((ModelName)"claude-sonnet-4-5");
    [Fact] void should_derive_powerful_instead_of_preserving_the_old_mapping() => _rows.Single(row => row.Tier == ModelTier.Powerful).Model.ShouldEqual((ModelName)"claude-opus-4-5");
    [Fact] void should_borrow_for_premier_instead_of_preserving_the_old_mapping() => _rows.Single(row => row.Tier == ModelTier.Premier).Model.ShouldEqual((ModelName)"claude-opus-4-5");
    [Fact] void should_identify_the_derived_source() => _rows.Single(row => row.Tier == ModelTier.Balanced).Source.ShouldEqual(TierModelSource.Derived);
    [Fact] void should_identify_the_borrowed_source() => _rows.Single(row => row.Tier == ModelTier.Premier).Source.ShouldEqual(TierModelSource.Borrowed);
    [Fact] void should_not_mutate_the_current_mapping() => _provider.TierModels.Balanced.ShouldEqual((ModelName)"old-balanced");
}
