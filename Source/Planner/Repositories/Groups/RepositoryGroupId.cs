// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Groups;

/// <summary>
/// The identity of a named group of repositories.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record RepositoryGroupId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset group identity.
    /// </summary>
    public static readonly RepositoryGroupId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="RepositoryGroupId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator RepositoryGroupId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique group identity.
    /// </summary>
    /// <returns>A new <see cref="RepositoryGroupId"/>.</returns>
    public static RepositoryGroupId New() => new(Guid.NewGuid());
}
