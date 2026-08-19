// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Roadmap;

/// <summary>
/// The identity of a plan.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record PlanId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset plan identity.
    /// </summary>
    public static readonly PlanId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="PlanId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator PlanId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique plan identity.
    /// </summary>
    /// <returns>A new <see cref="PlanId"/>.</returns>
    public static PlanId New() => new(Guid.NewGuid());
}
