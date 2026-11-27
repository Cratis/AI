// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Chronicle.ReadModels;

namespace LearningPath.Production.Carts;

/// <summary>
/// Represents the current state of a shopping cart, projected from its events and served by an Arc query.
/// </summary>
/// <param name="Id">The cart's identity.</param>
/// <param name="ItemCount">The number of items currently in the cart.</param>
/// <param name="CheckedOut">Whether the cart has been checked out.</param>
/// <param name="ConfirmationSent">Whether the order confirmation has been sent.</param>
[ReadModel]
public record CartSummary(
    CartId Id,

    [AddFrom<ItemAddedToCart>(nameof(ItemAddedToCart.Quantity))]
    [SubtractFrom<ItemRemovedFromCart>(nameof(ItemRemovedFromCart.Quantity))]
    int ItemCount,

    [SetValue<CartCheckedOut>(true)]
    bool CheckedOut,

    [SetValue<OrderConfirmationSent>(true)]
    bool ConfirmationSent)
{
    /// <summary>
    /// Gets the current state of one cart.
    /// </summary>
    /// <param name="id">The cart to get.</param>
    /// <param name="readModels">Chronicle's read models, resolved by Arc from dependency injection.</param>
    /// <returns>The cart's current state.</returns>
    [Authorize]
    public static Task<CartSummary> ById(CartId id, IReadModels readModels) =>
        readModels.GetInstanceById<CartSummary>((EventSourceId)id);
}
