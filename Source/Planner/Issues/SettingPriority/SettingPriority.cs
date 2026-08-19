// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.SettingPriority;

/// <summary>
/// Command for setting how urgently an issue should be worked on - explicit and set by a person,
/// so it takes precedence over anything triage suggests. Pass <see cref="Priority.NotSet"/> to
/// clear it.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Priority">The priority to set, or <see cref="Priority.NotSet"/> to clear it.</param>
[Command]
public record SetIssuePriority(IssueId Issue, Priority Priority)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssuePrioritySet"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssuePrioritySet Handle() => new(Priority);
}

/// <summary>
/// Event raised when an issue's priority has been explicitly set (or cleared, when
/// <see cref="Priority"/> is <see cref="Issues.Priority.NotSet"/>).
/// </summary>
/// <param name="Priority">The priority that was set.</param>
[EventType]
public record IssuePrioritySet(Priority Priority);
