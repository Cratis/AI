// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Accounts;

/// <summary>
/// The display name of a Claude account.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AccountName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset account name.
    /// </summary>
    public static readonly AccountName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AccountName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AccountName(string value) => new(value);
}
