// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The title of a pull request.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record PullRequestTitle(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset pull request title.
    /// </summary>
    public static readonly PullRequestTitle NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="PullRequestTitle"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator PullRequestTitle(string value) => new(value);
}
