// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TierModelResolution.when_nothing_is_configured;

/// <summary>
/// Nothing mapped and nothing discovered resolves to nothing. Dispatch refuses a provider that can
/// name no model for the tier, with a message naming the fix - which is the behavior the vendor
/// default table used to hide behind a model name that may not have existed (#1187).
/// </summary>
public class and_no_catalog_was_ever_discovered : Specification
{
    [Fact]
    void should_resolve_to_no_model() =>
        TierModelResolution.Resolve(null, null, ModelTier.Fast).ShouldEqual(ModelName.NotSet);

    [Fact]
    void should_resolve_to_no_model_when_the_catalog_came_back_empty() =>
        TierModelResolution.Resolve(TierModels.NotSet, [], ModelTier.Premier).ShouldEqual(ModelName.NotSet);
}
