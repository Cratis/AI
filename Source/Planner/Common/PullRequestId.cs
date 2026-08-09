// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The identity of a pull request - the predictable key <c>{org}-{repo}-{number}</c> (lowercased),
/// mirroring <see cref="IssueId"/>.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record PullRequestId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an unset pull request identity.
    /// </summary>
    public static readonly PullRequestId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="PullRequestId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator PullRequestId(string value) => new(value);

    /// <summary>
    /// Creates a <see cref="PullRequestId"/> from the owner, repository and pull request number.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="repository">The repository the pull request belongs to.</param>
    /// <param name="number">The pull request number.</param>
    /// <returns>The predictable identity for the pull request.</returns>
    public static PullRequestId From(OrganizationName owner, RepositoryName repository, PullRequestNumber number) =>
        new($"{owner.Value}-{repository.Value}-{number.Value}".ToLowerInvariant());
}
