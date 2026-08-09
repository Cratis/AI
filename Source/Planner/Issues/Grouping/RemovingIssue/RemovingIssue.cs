// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Grouping.RemovingIssue;

/// <summary>
/// Command for removing an issue from its group - dragging an issue out of the group.
/// </summary>
/// <param name="Issue">The identity of the issue to remove from its group.</param>
[Command]
public record RemoveIssueFromGroup(IssueId Issue)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueRemovedFromGroup"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueRemovedFromGroup Handle() => new();
}

/// <summary>
/// Event raised when an issue has been removed from its group.
/// </summary>
[EventType]
public record IssueRemovedFromGroup;
