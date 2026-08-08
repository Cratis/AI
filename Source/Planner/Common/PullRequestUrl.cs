// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The html URL of a pull request on GitHub.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record PullRequestUrl(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset pull request URL.
    /// </summary>
    public static readonly PullRequestUrl NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="PullRequestUrl"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator PullRequestUrl(string value) => new(value);
}
