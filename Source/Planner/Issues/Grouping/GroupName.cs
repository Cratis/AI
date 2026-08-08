// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Grouping;

/// <summary>
/// The display name of an issue group.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record GroupName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset group name.
    /// </summary>
    public static readonly GroupName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="GroupName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator GroupName(string value) => new(value);
}
