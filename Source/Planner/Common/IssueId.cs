// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The identity of an issue - the predictable key <c>{org}-{repo}-{issue}</c> (lowercased),
/// for instance <c>cratis-studio-256</c>.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record IssueId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an unset issue identity.
    /// </summary>
    public static readonly IssueId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="IssueId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator IssueId(string value) => new(value);

    /// <summary>
    /// Creates an <see cref="IssueId"/> from the owner, repository and issue number.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="repository">The repository the issue belongs to.</param>
    /// <param name="number">The issue number.</param>
    /// <returns>The predictable identity for the issue.</returns>
    public static IssueId From(OrganizationName owner, RepositoryName repository, IssueNumber number) =>
        new($"{owner.Value}-{repository.Value}-{number.Value}".ToLowerInvariant());
}
