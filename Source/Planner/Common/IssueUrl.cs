// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The html URL of an issue on GitHub.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record IssueUrl(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset URL.
    /// </summary>
    public static readonly IssueUrl NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="IssueUrl"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator IssueUrl(string value) => new(value);
}
