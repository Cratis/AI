// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work;

/// <summary>
/// The identity of a unit of scheduled agent work.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record WorkId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset work identity.
    /// </summary>
    public static readonly WorkId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="WorkId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WorkId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique work identity.
    /// </summary>
    /// <returns>A new <see cref="WorkId"/>.</returns>
    public static WorkId New() => new(Guid.NewGuid());
}
