// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace LearningPath.Production.Carts.for_CheckOutCart;

public class when_the_caller_has_no_customer_role : given.a_cart_command_scenario<CheckOutCart>
{
    void Establish()
    {
        _principal.Current.Returns(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "sample-visitor")], "spec")));
        _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee beans", 2));
    }

    async Task Because() => _result = await _scenario.Execute(new CheckOutCart(_cartId));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_deny_checkout() => _result.ShouldNotBeAuthorized();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}
