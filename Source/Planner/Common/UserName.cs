// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The login name of a GitHub user.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record UserName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset user name.
    /// </summary>
    public static readonly UserName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="UserName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator UserName(string value) => new(value);
}
