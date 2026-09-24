// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelResolution.when_the_catalog_is_empty;

/// <summary>
/// Nothing configured and nothing discovered resolves to nothing - never to a guessed model name.
/// </summary>
/// <remarks>
/// The hardcoded vendor table this replaced would answer here, which is precisely the failure it
/// caused: a provider whose catalog had never been read still resolved to a name from the table,
/// and a name the vendor does not serve dispatches to whatever the harness falls back to. An unset
/// answer is one a caller can see and act on.
/// </remarks>
public class and_nothing_is_configured_either : Specification
{
    [Fact]
    void should_resolve_to_not_set() =>
        TierModelResolution.Resolve(TierModels.NotSet, [], ModelTier.Premier).ShouldEqual(ModelName.NotSet);

    [Fact]
    void should_resolve_to_not_set_when_the_catalog_is_absent_entirely() =>
        TierModelResolution.Resolve(TierModels.NotSet, null, ModelTier.Premier).ShouldEqual(ModelName.NotSet);
}
