// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.ChangingAssignees;

/// <summary>
/// Command for changing the assignees of an issue - mirroring assignment on GitHub. The full assignee
/// set travels as one fact; GitHub's assigned/unassigned deliveries both carry the resulting set.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Assignees">The GitHub logins the issue is now assigned to.</param>
[Command]
public record ChangeIssueAssignees(IssueId Issue, IEnumerable<UserName> Assignees)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueAssigneesChanged"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueAssigneesChanged Handle() => new(Assignees);
}

/// <summary>
/// Event raised when the assignees of an issue have changed on GitHub - carries the full resulting set.
/// </summary>
/// <param name="Assignees">The GitHub logins the issue is now assigned to.</param>
[EventType]
public record IssueAssigneesChanged(IEnumerable<UserName> Assignees);
