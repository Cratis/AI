// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The markdown body of an issue.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record IssueBody(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an issue without a body.
    /// </summary>
    public static readonly IssueBody NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="IssueBody"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator IssueBody(string value) => new(value);
}
