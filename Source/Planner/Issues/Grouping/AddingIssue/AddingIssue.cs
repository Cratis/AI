// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Grouping.AddingIssue;

/// <summary>
/// Command for adding an issue to an existing group - dragging an issue into the group.
/// </summary>
/// <param name="Group">The identity of the group.</param>
/// <param name="Issue">The identity of the issue to add.</param>
[Command]
public record AddIssueToGroup(GroupId Group, IssueId Issue) : ICanProvideEventSourceId
{
    /// <summary>
    /// The event source is the issue - group membership is a fact on the issue's own stream.
    /// </summary>
    /// <returns>The issue's event source id.</returns>
    public EventSourceId GetEventSourceId() => Issue;

    /// <summary>
    /// Handles the command by appending an <see cref="Creating.IssueAddedToGroup"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public Creating.IssueAddedToGroup Handle() => new(Group);
}
