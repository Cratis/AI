// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.WeeklyDigests;

/// <summary>
/// The identity of a weekly digest entry.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record WeeklyDigestId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset weekly digest identity.
    /// </summary>
    public static readonly WeeklyDigestId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="WeeklyDigestId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WeeklyDigestId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique weekly digest identity.
    /// </summary>
    /// <returns>A new <see cref="WeeklyDigestId"/>.</returns>
    public static WeeklyDigestId New() => new(Guid.NewGuid());
}
