// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_AddItemToCart;

public class when_adding_an_item : given.an_add_item_scenario
{
    async Task Because() => _result = await _scenario.Execute(new AddItemToCart(_cartId, "Coffee beans", 2));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_append_the_item_to_the_cart() => await _scenario.ShouldHaveAppendedEvent<AddItemToCart, ItemAddedToCart>(_cartId, @event => @event.Product.Value == "Coffee beans" && @event.Quantity.Value == 2);
}
