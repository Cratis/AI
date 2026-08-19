// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.ChangingMilestone;

/// <summary>
/// Command for changing the milestone of an issue - mirroring milestoning on GitHub. Every issue
/// webhook delivery carries the current milestone (or none), regardless of which action triggered
/// it, so this is applied unconditionally rather than only on <c>milestoned</c>/<c>demilestoned</c>.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Milestone">The milestone the issue is now attached to, or <see cref="MilestoneName.NotSet"/> for none.</param>
[Command]
public record ChangeIssueMilestone(IssueId Issue, MilestoneName Milestone)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueMilestoneChanged"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueMilestoneChanged Handle() => new(Milestone);
}

/// <summary>
/// Event raised when the milestone of an issue has changed on GitHub.
/// </summary>
/// <param name="Milestone">The milestone the issue is now attached to, or <see cref="MilestoneName.NotSet"/> for none.</param>
[EventType]
public record IssueMilestoneChanged(MilestoneName Milestone);
