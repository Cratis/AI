// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_RemoveItemFromCart;

public class when_removing_an_item : given.a_cart_command_scenario<RemoveItemFromCart>
{
    void Establish() => _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee beans", 2));

    async Task Because() => _result = await _scenario.Execute(new RemoveItemFromCart(_cartId, "Coffee beans", 1));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_append_the_removal_to_the_cart() => await _scenario.ShouldHaveAppendedEvent<RemoveItemFromCart, ItemRemovedFromCart>(_cartId, @event => @event.Product.Value == "Coffee beans" && @event.Quantity.Value == 1);
}
