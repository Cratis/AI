// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The raw content of a weekly digest as delivered by the job that produced it.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record WeeklyDigestContent(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no content.
    /// </summary>
    public static readonly WeeklyDigestContent NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="WeeklyDigestContent"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WeeklyDigestContent(string value) => new(value);
}
