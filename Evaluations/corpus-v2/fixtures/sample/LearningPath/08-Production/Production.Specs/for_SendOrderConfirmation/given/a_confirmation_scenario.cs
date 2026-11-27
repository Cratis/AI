// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.DependencyInjection;

namespace LearningPath.Production.Carts.for_SendOrderConfirmation.given;

public class a_confirmation_scenario : Specification
{
    protected readonly CartId _cartId = CartId.New();
    protected IOrderConfirmations _confirmations;
    protected ReactorScenario<SendOrderConfirmation> _scenario;

    void Establish()
    {
        _confirmations = Substitute.For<IOrderConfirmations>();
        _scenario = new();
        _scenario.Services.AddSingleton(_confirmations);
    }

    void Destroy() => _scenario.Dispose();
}
