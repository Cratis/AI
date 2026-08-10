// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// The one-line headline of an alert.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AlertTitle(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset title.
    /// </summary>
    public static readonly AlertTitle NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AlertTitle"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AlertTitle(string value) => new(value);
}
