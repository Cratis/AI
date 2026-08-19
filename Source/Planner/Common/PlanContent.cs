// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The markdown content of a plan covering a set of issues.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record PlanContent(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing a plan that has not been generated yet.
    /// </summary>
    public static readonly PlanContent NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="PlanContent"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator PlanContent(string value) => new(value);
}
