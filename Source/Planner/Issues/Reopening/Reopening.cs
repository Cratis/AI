// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Reopening;

/// <summary>
/// Command for reopening an issue - mirroring the issue being reopened on GitHub.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
[Command]
public record ReopenIssue(IssueId Issue)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueReopened"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueReopened Handle() => new();
}

/// <summary>
/// Event raised when an issue has been reopened on GitHub.
/// </summary>
[EventType]
public record IssueReopened;
