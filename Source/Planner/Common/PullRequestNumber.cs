// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The number of a pull request within its repository.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record PullRequestNumber(int Value) : ConceptAs<int>(Value)
{
    /// <summary>
    /// The value representing an unset pull request number.
    /// </summary>
    public static readonly PullRequestNumber NotSet = new(0);

    /// <summary>
    /// Implicitly convert from <see cref="int"/> to <see cref="PullRequestNumber"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator PullRequestNumber(int value) => new(value);
}
