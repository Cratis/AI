// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Accounts;

/// <summary>
/// The identity of a Claude account the Planner can schedule work on.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AccountId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset account identity.
    /// </summary>
    public static readonly AccountId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="AccountId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AccountId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique account identity.
    /// </summary>
    /// <returns>A new <see cref="AccountId"/>.</returns>
    public static AccountId New() => new(Guid.NewGuid());
}
