// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;

namespace Library.Orders;

/// <summary>
/// Emitted when an order is placed.
/// </summary>
/// <param name="OrderNumber">The order number.</param>
[EventType("order-placed-v1")]
public record LegacyOrderPlaced(string OrderNumber);
