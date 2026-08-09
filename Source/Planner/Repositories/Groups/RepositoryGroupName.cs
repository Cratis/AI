// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Groups;

/// <summary>
/// The display name of a named group of repositories.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record RepositoryGroupName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset group name.
    /// </summary>
    public static readonly RepositoryGroupName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="RepositoryGroupName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator RepositoryGroupName(string value) => new(value);
}
