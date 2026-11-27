// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts;

/// <summary>
/// Prints order confirmations in the sample instead of sending real email.
/// </summary>
public class OrderConfirmations : IOrderConfirmations
{
    /// <inheritdoc/>
    public void Send(CartId cartId) => Console.WriteLine($"Order confirmation sent for cart {cartId.Value} (sample only; no email sent).");
}
