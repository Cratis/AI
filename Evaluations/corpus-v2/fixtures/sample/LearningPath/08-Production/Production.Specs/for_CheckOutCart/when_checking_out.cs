// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_CheckOutCart;

public class when_checking_out : given.a_cart_command_scenario<CheckOutCart>
{
    void Establish() => _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee beans", 2));

    async Task Because() => _result = await _scenario.Execute(new CheckOutCart(_cartId));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_append_checkout_to_the_cart() => await _scenario.ShouldHaveAppendedEvent<CheckOutCart, CartCheckedOut>(_cartId);
}
