// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// The system an alert came from - a deployment, a cluster, a watchdog. It scopes the alert's
/// identity, so the same finding reported by two different systems stays two alerts.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AlertSource(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset source.
    /// </summary>
    public static readonly AlertSource NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AlertSource"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AlertSource(string value) => new(value);
}
