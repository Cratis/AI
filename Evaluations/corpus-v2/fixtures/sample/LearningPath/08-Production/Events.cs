// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;

namespace LearningPath.Production.Carts;

/// <summary>
/// Records that a product was added to a shopping cart.
/// </summary>
/// <param name="Product">The product that was added.</param>
/// <param name="Quantity">How many were added.</param>
[EventType]
public record ItemAddedToCart(ProductName Product, Quantity Quantity);

/// <summary>
/// Records that a product was removed from a shopping cart.
/// </summary>
/// <param name="Product">The product that was removed.</param>
/// <param name="Quantity">How many were removed.</param>
[EventType]
public record ItemRemovedFromCart(ProductName Product, Quantity Quantity);

/// <summary>
/// Records that a shopping cart was checked out. The fact that it happened is the whole story.
/// </summary>
[EventType]
public record CartCheckedOut;

/// <summary>
/// Records that an order confirmation was sent after a shopping cart was checked out.
/// </summary>
[EventType]
public record OrderConfirmationSent;
