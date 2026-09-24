// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_configured_mapping_leaves_the_tier_unset;

/// <summary>
/// A mapping is honoured tier by tier, so the tiers it leaves alone still come from the catalog.
/// </summary>
public class and_the_catalog_covers_it : Specification
{
    static readonly ModelName[] _catalog =
    [
        new("claude-haiku-4-5"),
        new("claude-sonnet-4-5"),
        new("claude-opus-4-5")
    ];

    [Fact]
    void should_resolve_the_unset_tier_from_the_catalog() =>
        TierModelResolution.Resolve(
            new TierModels(
                Fast: new ModelName("configured-fast"),
                Balanced: ModelName.NotSet,
                Powerful: ModelName.NotSet,
                Premier: ModelName.NotSet),
            _catalog,
            ModelTier.Balanced).ShouldEqual(new ModelName("claude-sonnet-4-5"));

    [Fact]
    void should_still_honour_the_tier_that_was_mapped() =>
        TierModelResolution.Resolve(
            new TierModels(
                Fast: new ModelName("configured-fast"),
                Balanced: ModelName.NotSet,
                Powerful: ModelName.NotSet,
                Premier: ModelName.NotSet),
            _catalog,
            ModelTier.Fast).ShouldEqual(new ModelName("configured-fast"));
}
