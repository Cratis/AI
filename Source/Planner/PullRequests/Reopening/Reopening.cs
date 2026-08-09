// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.PullRequests.Reopening;

/// <summary>
/// Command for reopening a pull request mirrored from GitHub - executed by the webhook receiver
/// when a previously closed pull request is reopened.
/// </summary>
/// <param name="PullRequest">The identity of the pull request.</param>
[Command]
public record ReopenPullRequest(PullRequestId PullRequest)
{
    /// <summary>
    /// Handles the command by appending a <see cref="PullRequestReopened"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public PullRequestReopened Handle() => new();
}

/// <summary>
/// Event raised when a pull request mirrored from GitHub has been reopened.
/// </summary>
[EventType]
public record PullRequestReopened;
