// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues;

/// <summary>
/// The manual sort position of an issue in the issue list. Fractional values allow placing an
/// issue between two others without renumbering the rest.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record SortOrder(double Value) : ConceptAs<double>(Value)
{
    /// <summary>
    /// The value representing an unset sort order.
    /// </summary>
    public static readonly SortOrder NotSet = new(0d);

    /// <summary>
    /// Implicitly convert from <see cref="double"/> to <see cref="SortOrder"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator SortOrder(double value) => new(value);
}
