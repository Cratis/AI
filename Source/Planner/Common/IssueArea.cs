// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The part of the project an issue affects, in the project's own words (e.g. "Chronicle kernel",
/// "Arc proxy generator") - free-form, since triage does not know a project's area vocabulary ahead
/// of time.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record IssueArea(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unclassified area.
    /// </summary>
    public static readonly IssueArea NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="IssueArea"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator IssueArea(string value) => new(value);
}
