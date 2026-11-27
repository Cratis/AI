// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_RemoveItemFromCart;

public class when_quantity_is_zero : given.a_cart_command_scenario<RemoveItemFromCart>
{
    void Establish() => _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee beans", 2));

    async Task Because() => _result = await _scenario.Execute(new RemoveItemFromCart(_cartId, "Coffee beans", 0));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_reject_invalid_input() => _result.ShouldHaveValidationErrors();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}
