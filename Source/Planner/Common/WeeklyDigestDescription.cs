// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The personal, narrative description of a weekly digest - the "what a week" copy shown before
/// publishing.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record WeeklyDigestDescription(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no description.
    /// </summary>
    public static readonly WeeklyDigestDescription NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="WeeklyDigestDescription"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WeeklyDigestDescription(string value) => new(value);
}
