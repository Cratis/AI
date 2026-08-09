// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Reordering;

/// <summary>
/// Command for placing an issue at a new position in the manually sorted issue list.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Order">The new sort position - fractional values place an issue between two others.</param>
[Command]
public record ReorderIssue(IssueId Issue, SortOrder Order)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueReordered"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueReordered Handle() => new(Order);
}

/// <summary>
/// Event raised when an issue has been placed at a new position in the manually sorted issue list.
/// </summary>
/// <param name="Order">The sort position.</param>
[EventType]
public record IssueReordered(SortOrder Order);
