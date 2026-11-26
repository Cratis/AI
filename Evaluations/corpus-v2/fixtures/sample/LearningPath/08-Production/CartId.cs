// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;

namespace LearningPath.Production.Carts;

/// <summary>
/// Represents the identity of a shopping cart, and with it the event source its events belong to.
/// </summary>
/// <param name="Value">The underlying identifier.</param>
public record CartId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// Converts a <see cref="Guid"/> to a <see cref="CartId"/>.
    /// </summary>
    /// <param name="value">The value to convert.</param>
    /// <returns>The strongly typed cart identifier.</returns>
    public static implicit operator CartId(Guid value) => new(value);

    /// <summary>
    /// Creates a new cart identifier.
    /// </summary>
    /// <returns>A new <see cref="CartId"/>.</returns>
    public static CartId New() => new(Guid.NewGuid());
}
