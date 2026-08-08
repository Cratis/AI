// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The type of an issue, such as <c>Bug</c>, <c>Feature</c> or <c>Task</c> - as classified on GitHub.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record IssueType(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an issue without a type.
    /// </summary>
    public static readonly IssueType NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="IssueType"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator IssueType(string value) => new(value);
}
