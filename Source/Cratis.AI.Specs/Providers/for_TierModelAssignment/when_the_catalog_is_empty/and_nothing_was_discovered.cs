// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelAssignment.when_the_catalog_is_empty;

/// <summary>
/// The case the hardcoded vendor catalogs used to paper over. Nothing discovered means nothing to
/// map, and a tier with nothing behind it is refused at dispatch with a message naming the fix -
/// rather than resolving to a model name Direct made up and the vendor may never have served.
/// </summary>
public class and_nothing_was_discovered : Specification
{
    [Fact] void should_map_no_tier_at_all() => TierModelAssignment.From([]).IsNotSet().ShouldBeTrue();

    [Fact] void should_map_no_tier_at_all_when_never_discovered() => TierModelAssignment.From(null).IsNotSet().ShouldBeTrue();
}
