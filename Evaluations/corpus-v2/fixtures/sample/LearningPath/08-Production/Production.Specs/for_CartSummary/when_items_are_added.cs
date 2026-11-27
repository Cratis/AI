// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_CartSummary;

public class when_items_are_added : given.a_cart_summary_scenario
{
    async Task Because() => await _scenario.Given.ForEventSource(_cartId).Events(
        new ItemAddedToCart("Coffee beans", 2), new ItemAddedToCart("Filter papers", 3));

    [Fact] void should_identify_the_cart() => _cart.Id.ShouldEqual(_cartId);
    [Fact] void should_sum_the_quantities() => _cart.ItemCount.ShouldEqual(5);
    [Fact] void should_not_be_checked_out() => _cart.CheckedOut.ShouldBeFalse();
    [Fact] void should_not_have_sent_confirmation() => _cart.ConfirmationSent.ShouldBeFalse();
}
