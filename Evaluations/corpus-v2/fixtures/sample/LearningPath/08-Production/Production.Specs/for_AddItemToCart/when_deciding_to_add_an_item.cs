// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Validation;
using Cratis.Chronicle.ReadModels;
using Cratis.Monads;

namespace LearningPath.Production.Carts.for_AddItemToCart;

public class when_deciding_to_add_an_item : Specification
{
    Result<ItemAddedToCart, ValidationResult> _result;
    ItemAddedToCart _event;

    void Because()
    {
        var id = CartId.New();
        var cart = DecisionRead<CartSummary>.Unprotected(id.Value.ToString(), null);
        _result = new AddItemToCart(id, "Coffee beans", 2).Handle(cart);
        _result.TryGetResult(out _event);
    }

    [Fact] void should_choose_an_add_event() => _result.IsSuccess.ShouldBeTrue();

    [Fact] void should_record_the_product() => _event.Product.Value.ShouldEqual("Coffee beans");
    [Fact] void should_record_the_quantity() => _event.Quantity.Value.ShouldEqual(2);
}
