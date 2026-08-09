// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The title of an issue.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record IssueTitle(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset issue title.
    /// </summary>
    public static readonly IssueTitle NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="IssueTitle"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator IssueTitle(string value) => new(value);
}
