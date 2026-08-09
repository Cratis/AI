// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.GitIdentity;

/// <summary>
/// The <c>git config user.email</c> commits made by worker containers carry.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record GitUserEmail(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset git user email.
    /// </summary>
    public static readonly GitUserEmail NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="GitUserEmail"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator GitUserEmail(string value) => new(value);
}
