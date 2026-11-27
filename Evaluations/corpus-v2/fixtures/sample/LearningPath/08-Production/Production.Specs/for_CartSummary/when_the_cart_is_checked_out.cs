// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_CartSummary;

public class when_the_cart_is_checked_out : given.a_cart_summary_scenario
{
    async Task Because() => await _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee beans", 2), new CartCheckedOut());

    [Fact] void should_be_checked_out() => _cart.CheckedOut.ShouldBeTrue();
    [Fact] void should_preserve_the_item_count() => _cart.ItemCount.ShouldEqual(2);
    [Fact] void should_not_have_sent_confirmation_yet() => _cart.ConfirmationSent.ShouldBeFalse();
}
