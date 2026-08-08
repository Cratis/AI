// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work;

/// <summary>
/// The reason a unit of work failed.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record FailureReason(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset failure reason.
    /// </summary>
    public static readonly FailureReason NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="FailureReason"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator FailureReason(string value) => new(value);
}
