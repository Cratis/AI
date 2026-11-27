// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Chronicle.ReadModels;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Validation;
using Cratis.Chronicle.ReadModels;
using Cratis.Monads;

namespace LearningPath.Production.Carts;

/// <summary>
/// Removes a product from a shopping cart.
/// </summary>
/// <param name="CartId">The cart to remove from.</param>
/// <param name="Product">The product to remove.</param>
/// <param name="Quantity">How many to remove.</param>
[Command]
[Authorize]
[ProtectedDecision]
public record RemoveItemFromCart(CartId CartId, ProductName Product, Quantity Quantity)
{
    /// <summary>
    /// Handles the command by deciding which event happened.
    /// </summary>
    /// <param name="cart">The cart state, folded from events and guarded until commit.</param>
    /// <returns>The event to append, or a rejection when the cart is already checked out.</returns>
    public Result<ItemRemovedFromCart, ValidationResult> Handle(DecisionRead<CartSummary> cart) =>
        cart.Instance is { CheckedOut: true }
            ? ValidationResult.Error("Cannot remove items after checkout.")
            : new ItemRemovedFromCart(Product, Quantity);
}
