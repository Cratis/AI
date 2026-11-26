// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Concepts;

namespace LearningPath.Production.Carts;

/// <summary>
/// Represents how many of a product a change to a shopping cart involves.
/// </summary>
/// <param name="Value">The number of items.</param>
public record Quantity(int Value) : ConceptAs<int>(Value)
{
    /// <summary>
    /// Converts a number to a quantity.
    /// </summary>
    /// <param name="value">The number to convert.</param>
    /// <returns>The quantity.</returns>
    public static implicit operator Quantity(int value) => new(value);
}
