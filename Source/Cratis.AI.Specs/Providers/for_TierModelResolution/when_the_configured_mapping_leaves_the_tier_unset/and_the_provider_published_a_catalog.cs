// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_configured_mapping_leaves_the_tier_unset;

/// <summary>
/// The partially-mapped provider. The tiers somebody named stay named; the one left blank falls
/// through to the catalog the provider itself published, not to anything Direct decided in advance.
/// </summary>
public class and_the_provider_published_a_catalog : Specification
{
    static readonly IEnumerable<ModelName> _catalog =
    [
        new ModelName("claude-opus-4-5-20251101"),
        new ModelName("claude-sonnet-4-5-20250929"),
        new ModelName("claude-haiku-4-5-20251001"),
    ];

    static readonly TierModels _configured = TierModels.NotSet with { Balanced = new ModelName("configured-balanced") };

    [Fact]
    void should_resolve_the_mapped_tier_to_the_mapping() =>
        TierModelResolution.Resolve(_configured, _catalog, ModelTier.Balanced).ShouldEqual(new ModelName("configured-balanced"));

    [Fact]
    void should_resolve_the_unmapped_tier_from_the_catalog() =>
        TierModelResolution.Resolve(_configured, _catalog, ModelTier.Powerful).ShouldEqual(new ModelName("claude-opus-4-5-20251101"));
}
