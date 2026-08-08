// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues;

/// <summary>
/// The markdown summary an investigation produced for an issue - the plan for how it can be
/// implemented or fixed.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record InvestigationSummary(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset investigation summary.
    /// </summary>
    public static readonly InvestigationSummary NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="InvestigationSummary"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator InvestigationSummary(string value) => new(value);
}
