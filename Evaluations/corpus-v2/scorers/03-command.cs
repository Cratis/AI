// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.SuiteHidden;

public class for_GiftWrapCart_contract : given.a_cart_command_scenario<GiftWrapCart>
{
    async Task Because() => _result = await _scenario.Execute(new GiftWrapCart(_cartId, "Handle with care"));

    [Fact]
    void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_attribute_the_event_to_the_cart() =>
        await _scenario.ShouldHaveAppendedEvent<GiftWrapCart, GiftWrappingRequested>(_cartId);
}
