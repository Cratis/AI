// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// A cost in USD as the Claude CLI reports it for a session.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record UsageCost(decimal Value) : ConceptAs<decimal>(Value)
{
    /// <summary>
    /// The value representing an unknown cost.
    /// </summary>
    public static readonly UsageCost NotSet = new(0m);

    /// <summary>
    /// Implicitly convert from <see cref="decimal"/> to <see cref="UsageCost"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator UsageCost(decimal value) => new(value);
}
