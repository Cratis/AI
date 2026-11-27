// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_AddItemToCart;

public class when_product_name_is_empty : given.an_add_item_scenario
{
    async Task Because() => _result = await _scenario.Execute(new AddItemToCart(_cartId, string.Empty, 1));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_reject_invalid_input() => _result.ShouldHaveValidationErrors();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}
