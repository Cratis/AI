// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace LearningPath.Production.Carts.for_CartSummary;

public class when_querying_as_an_anonymous_caller : given.a_cart_query_scenario
{
    void Establish() => _principal.Current.Returns((ClaimsPrincipal)null);

    async Task Because() => _result = await _scenario.Perform(nameof(CartSummary.ById), new() { ["id"] = _cartId.Value.ToString() });

    [Fact] void should_not_succeed() => _result.IsSuccess.ShouldBeFalse();
    [Fact] void should_deny_access() => _result.IsAuthorized.ShouldBeFalse();
    [Fact] void should_disclose_no_cart() => _result.Data.ShouldBeNull();
}
