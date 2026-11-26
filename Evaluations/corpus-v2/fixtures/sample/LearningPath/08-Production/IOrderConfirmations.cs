// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts;

/// <summary>
/// Defines how order confirmations are sent.
/// </summary>
public interface IOrderConfirmations
{
    /// <summary>
    /// Sends a confirmation for a checked-out shopping cart.
    /// </summary>
    /// <param name="cartId">The cart that was checked out.</param>
    void Send(CartId cartId);
}
