// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// Extra, free-form instructions given alongside a set of issues when requesting a plan.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record PlanInstructions(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no extra instructions.
    /// </summary>
    public static readonly PlanInstructions NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="PlanInstructions"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator PlanInstructions(string value) => new(value);
}
