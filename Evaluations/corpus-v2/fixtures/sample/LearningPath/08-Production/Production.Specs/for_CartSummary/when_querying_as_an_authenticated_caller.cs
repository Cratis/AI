// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_CartSummary;

public class when_querying_as_an_authenticated_caller : given.a_cart_query_scenario
{
    async Task Because() => _result = await _scenario.Perform(nameof(CartSummary.ById), new() { ["id"] = _cartId.Value.ToString() });

    [Fact] void should_succeed_without_a_customer_role() => _result.IsSuccess.ShouldBeTrue();
    [Fact] void should_return_the_cart() => ((CartSummary)_result.Data).Id.ShouldEqual(_cartId);
    [Fact] void should_return_the_projected_count() => ((CartSummary)_result.Data).ItemCount.ShouldEqual(2);
}
