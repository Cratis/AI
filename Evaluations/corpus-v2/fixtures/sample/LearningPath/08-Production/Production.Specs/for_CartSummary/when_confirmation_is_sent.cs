// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_CartSummary;

public class when_confirmation_is_sent : given.a_cart_summary_scenario
{
    async Task Because() => await _scenario.Given.ForEventSource(_cartId).Events(
        new ItemAddedToCart("Coffee beans", 2), new CartCheckedOut(), new OrderConfirmationSent());

    [Fact] void should_have_sent_confirmation() => _cart.ConfirmationSent.ShouldBeTrue();
    [Fact] void should_remain_checked_out() => _cart.CheckedOut.ShouldBeTrue();
    [Fact] void should_preserve_the_item_count() => _cart.ItemCount.ShouldEqual(2);
}
