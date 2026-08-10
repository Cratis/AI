// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// The body of an alert as the sending system described it - the detail an agent investigates from.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AlertSummary(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset summary.
    /// </summary>
    public static readonly AlertSummary NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AlertSummary"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AlertSummary(string value) => new(value);
}
