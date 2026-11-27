// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;
using Cratis.Chronicle.Reactors;

namespace LearningPath.Production.Carts;

/// <summary>
/// Sends an order confirmation after checkout has been recorded.
/// </summary>
/// <param name="orderConfirmations">The collaborator that sends the confirmation.</param>
public class SendOrderConfirmation(IOrderConfirmations orderConfirmations) : IReactor
{
    /// <summary>
    /// Sends the confirmation and records the consequence as a follow-up event.
    /// </summary>
    /// <param name="event">The checkout event that triggers the confirmation.</param>
    /// <param name="context">The event context identifying the cart.</param>
    /// <returns>The fact Chronicle appends to the same cart's event source.</returns>
    [OnceOnly]
    public OrderConfirmationSent CheckedOut(CartCheckedOut @event, EventContext context)
    {
        orderConfirmations.Send(new CartId(Guid.Parse(context.EventSourceId.Value)));

        return new();
    }
}
