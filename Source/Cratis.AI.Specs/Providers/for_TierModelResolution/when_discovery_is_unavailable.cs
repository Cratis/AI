// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.AvailableModels;

namespace Cratis.AI.Providers.for_TierModelResolution;

public class when_discovery_is_unavailable : Specification
{
    ConfiguredAIProvider _provider;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat01-fixture")
    {
        TierModels = TierModels.NotSet with { Fast = "chosen-fast" },
        AvailableModels = [new("claude-haiku-4-5")],
        ModelsDiscoveredAt = DateTimeOffset.Parse("2026-09-20T10:00:00Z"),
        ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable
    };

    [Fact]
    void should_honor_an_explicit_id_even_when_the_old_catalog_contradicts_it() =>
        TierModelResolution.Resolve(_provider with { TierModelMappingSource = TierModelMappingSource.Explicit }, ModelTier.Fast)
            .ShouldEqual(new ModelName("chosen-fast"));

    [Fact]
    void should_keep_resolving_a_legacy_table_without_recorded_provenance() =>
        TierModelResolution.Resolve(_provider, ModelTier.Fast).ShouldEqual(new ModelName("chosen-fast"));

    [Fact]
    void should_refuse_a_newly_derived_mapping()
    {
        var result = TierModelResolution.Explain(_provider with { TierModelMappingSource = TierModelMappingSource.Derived }, ModelTier.Fast);
        result.Model.ShouldEqual(ModelName.NotSet);
        result.Source.ShouldEqual(TierModelSource.Unsatisfied);
        result.Reason.ShouldContain("review and save");
    }

    [Fact]
    void should_not_promote_a_catalog_matching_mapping() =>
        TierModelResolution.Resolve(_provider with { TierModels = TierModels.NotSet with { Fast = "claude-haiku-4-5" }, TierModelMappingSource = TierModelMappingSource.Derived }, ModelTier.Fast)
            .ShouldEqual(ModelName.NotSet);

    [Fact]
    void should_not_derive_from_the_historical_catalog_or_fall_back_to_a_cli_alias() =>
        TierModelResolution.Resolve(_provider with { TierModels = TierModels.NotSet, TierModelMappingSource = TierModelMappingSource.Explicit }, ModelTier.Fast)
            .ShouldEqual(ModelName.NotSet);

    [Fact]
    void should_not_relax_a_genuine_failed_refresh() =>
        TierModelResolution.Resolve(_provider with { ModelDiscoveryStatus = AIModelDiscoveryStatus.Failed, TierModelMappingSource = TierModelMappingSource.Explicit }, ModelTier.Fast)
            .ShouldEqual(ModelName.NotSet);

    [Fact]
    void should_keep_successful_catalog_authority() =>
        TierModelResolution.Resolve(_provider with { ModelDiscoveryStatus = AIModelDiscoveryStatus.Discovered, TierModelMappingSource = TierModelMappingSource.Explicit }, ModelTier.Fast)
            .ShouldEqual(ModelName.NotSet);
}
