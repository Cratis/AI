// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The name of a git branch, as reported by GitHub for a pull request's head or base.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record BranchName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unknown branch.
    /// </summary>
    public static readonly BranchName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="BranchName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator BranchName(string value) => new(value);
}
