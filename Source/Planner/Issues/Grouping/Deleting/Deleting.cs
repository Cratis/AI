// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Issues.Grouping.RemovingIssue;

namespace Planner.Issues.Grouping.Deleting;

/// <summary>
/// Command for deleting a group, releasing all its member issues. The caller supplies the current
/// members - the frontend already holds them from the issue list.
/// </summary>
/// <param name="Group">The identity of the group to delete.</param>
/// <param name="Issues">The identities of the issues currently in the group.</param>
[Command]
public record DeleteGroup(GroupId Group, IEnumerable<IssueId> Issues)
{
    /// <summary>
    /// Handles the command by deleting the group and removing each member issue from it.
    /// </summary>
    /// <returns>The <see cref="GroupDeleted"/> event and an <see cref="IssueRemovedFromGroup"/> per member.</returns>
    public IEnumerable<EventForEventSourceId> Handle()
    {
        yield return new EventForEventSourceId(Group, new GroupDeleted());
        foreach (var issue in Issues)
        {
            yield return new EventForEventSourceId(issue, new IssueRemovedFromGroup());
        }
    }
}

/// <summary>
/// Event raised when a group has been deleted - its member issues are released back to the ungrouped list.
/// </summary>
[EventType]
public record GroupDeleted;
