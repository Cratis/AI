// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Closing;

/// <summary>
/// Command for closing an issue - mirroring the issue being closed on GitHub.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
[Command]
public record CloseIssue(IssueId Issue)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueClosed"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueClosed Handle() => new();
}

/// <summary>
/// Event raised when an issue has been closed on GitHub.
/// </summary>
[EventType]
public record IssueClosed;
