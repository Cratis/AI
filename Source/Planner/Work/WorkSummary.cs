// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work;

/// <summary>
/// The summary a worker reported when completing a unit of work.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record WorkSummary(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset summary.
    /// </summary>
    public static readonly WorkSummary NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="WorkSummary"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WorkSummary(string value) => new(value);
}
