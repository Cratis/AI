// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelAssignment.when_the_catalog_names_no_large_model;

/// <summary>
/// A vendor with nothing above its everyday model maps the upper tiers onto that one rather than
/// leaving them empty - the ladder is what Direct wants to express, not a claim about the vendor's
/// range. Borrowing upward, never downward: a tier asking for more must never quietly get less.
/// </summary>
public class and_only_a_small_and_an_everyday_one_exist : Specification
{
    TierModels _result;

    void Because() => _result = TierModelAssignment.From(
    [
        new ModelName("gpt-5.3"),
        new ModelName("gpt-5.3-mini"),
    ]);

    [Fact] void should_put_the_small_one_on_fast() => _result.Fast.ShouldEqual(new ModelName("gpt-5.3-mini"));

    [Fact] void should_put_the_everyday_one_on_balanced() => _result.Balanced.ShouldEqual(new ModelName("gpt-5.3"));

    [Fact] void should_borrow_the_everyday_one_for_powerful() => _result.Powerful.ShouldEqual(new ModelName("gpt-5.3"));

    [Fact] void should_borrow_the_everyday_one_for_premier() => _result.Premier.ShouldEqual(new ModelName("gpt-5.3"));
}
