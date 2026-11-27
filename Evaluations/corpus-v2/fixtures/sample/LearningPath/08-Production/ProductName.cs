// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Concepts;

namespace LearningPath.Production.Carts;

/// <summary>
/// Represents the name of a product placed in a shopping cart.
/// </summary>
/// <param name="Value">The product name.</param>
public record ProductName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// Converts text to a product name.
    /// </summary>
    /// <param name="value">The text to convert.</param>
    /// <returns>The product name.</returns>
    public static implicit operator ProductName(string value) => new(value);
}
