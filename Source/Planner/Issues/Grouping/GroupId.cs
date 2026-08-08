// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Grouping;

/// <summary>
/// The identity of an issue group. String-backed so the "not grouped" sentinel (empty) can be
/// written by model-bound projections when an issue leaves its group.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record GroupId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an issue that is not in a group.
    /// </summary>
    public static readonly GroupId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="GroupId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator GroupId(string value) => new(value);

    /// <summary>
    /// Creates a new unique group identity.
    /// </summary>
    /// <returns>A new <see cref="GroupId"/>.</returns>
    public static GroupId New() => new(Guid.NewGuid().ToString());
}
