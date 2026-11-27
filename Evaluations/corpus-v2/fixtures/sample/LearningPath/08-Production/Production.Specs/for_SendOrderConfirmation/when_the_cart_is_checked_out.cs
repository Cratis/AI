// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_SendOrderConfirmation;

public class when_the_cart_is_checked_out : given.a_confirmation_scenario
{
    async Task Because() => await _scenario.Given.ForEventSource(_cartId).Events(new CartCheckedOut());

    [Fact] void should_send_one_confirmation_for_the_cart() => _confirmations.Received(1).Send(_cartId);
    [Fact] void should_produce_confirmation_sent_for_the_same_cart() => _scenario.ShouldHaveProduced<OrderConfirmationSent>(_cartId);
}
