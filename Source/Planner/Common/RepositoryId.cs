// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The identity of a repository - the predictable key <c>{org}-{repo}</c> (lowercased).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record RepositoryId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an unset repository identity.
    /// </summary>
    public static readonly RepositoryId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="RepositoryId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator RepositoryId(string value) => new(value);

    /// <summary>
    /// Creates a <see cref="RepositoryId"/> from an owner and repository name.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="name">The repository name.</param>
    /// <returns>The predictable identity for the repository.</returns>
    public static RepositoryId From(OrganizationName owner, RepositoryName name) =>
        new($"{owner.Value}-{name.Value}".ToLowerInvariant());
}
