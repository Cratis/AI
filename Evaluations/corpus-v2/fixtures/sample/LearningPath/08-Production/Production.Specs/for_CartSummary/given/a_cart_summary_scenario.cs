// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_CartSummary.given;

public class a_cart_summary_scenario : Specification
{
    protected readonly CartId _cartId = CartId.New();
    protected ReadModelScenario<CartSummary> _scenario;
    protected CartSummary _cart => _scenario.Instance!;

    void Establish() => _scenario = new();
    void Destroy() => _scenario.Dispose();
}
