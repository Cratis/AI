// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_CartSummary;

public class when_an_item_is_removed : given.a_cart_summary_scenario
{
    async Task Because() => await _scenario.Given.ForEventSource(_cartId).Events(
        new ItemAddedToCart("Coffee beans", 2), new ItemAddedToCart("Filter papers", 3), new ItemRemovedFromCart("Coffee beans", 1));

    [Fact] void should_subtract_the_removed_quantity() => _cart.ItemCount.ShouldEqual(4);
}
