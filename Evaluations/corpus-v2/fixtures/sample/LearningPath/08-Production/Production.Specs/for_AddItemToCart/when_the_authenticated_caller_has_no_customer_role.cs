// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace LearningPath.Production.Carts.for_AddItemToCart;

public class when_the_authenticated_caller_has_no_customer_role : given.an_add_item_scenario
{
    void Establish() => _principal.Current.Returns(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "sample-visitor")], "spec")));

    async Task Because() => _result = await _scenario.Execute(new AddItemToCart(_cartId, "Coffee beans", 2));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_append_the_item() => await _scenario.ShouldHaveAppendedEvent<AddItemToCart, ItemAddedToCart>(_cartId);
}
