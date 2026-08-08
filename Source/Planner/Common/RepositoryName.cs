// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The name of a GitHub repository.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record RepositoryName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset repository name.
    /// </summary>
    public static readonly RepositoryName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="RepositoryName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator RepositoryName(string value) => new(value);
}
