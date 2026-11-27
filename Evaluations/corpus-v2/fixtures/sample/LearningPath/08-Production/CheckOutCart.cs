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
/// Checks out a shopping cart.
/// </summary>
/// <param name="CartId">The cart to check out.</param>
[Command]
[Roles(nameof(CartRole.Customer))]
[ProtectedDecision]
public record CheckOutCart(CartId CartId)
{
    /// <summary>
    /// Handles the command by deciding which event happened.
    /// </summary>
    /// <param name="cart">The cart state, folded from events and guarded until commit.</param>
    /// <returns>The checkout event, or a rejection when checkout already happened.</returns>
    public Result<CartCheckedOut, ValidationResult> Handle(DecisionRead<CartSummary> cart) =>
        cart.Instance is { CheckedOut: true }
            ? ValidationResult.Error("Cart has already been checked out.")
            : new CartCheckedOut();
}
