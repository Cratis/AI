// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace LearningPath.Production.Carts.for_RemoveItemFromCart;

public class when_the_caller_is_anonymous : given.a_cart_command_scenario<RemoveItemFromCart>
{
    void Establish() => _principal.Current.Returns((ClaimsPrincipal)null);

    async Task Because() => _result = await _scenario.Execute(new RemoveItemFromCart(_cartId, "Coffee beans", 1));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_deny_removal() => _result.ShouldNotBeAuthorized();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}
