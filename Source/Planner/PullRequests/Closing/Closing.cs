// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.PullRequests.Closing;

/// <summary>
/// Command for closing a pull request mirrored from GitHub - executed by the webhook receiver when
/// one is closed, whether merged or abandoned.
/// </summary>
/// <param name="PullRequest">The identity of the pull request.</param>
/// <param name="Merged">Whether the pull request was merged rather than simply closed.</param>
[Command]
public record ClosePullRequest(PullRequestId PullRequest, bool Merged)
{
    /// <summary>
    /// Handles the command by appending a <see cref="PullRequestClosed"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public PullRequestClosed Handle() => new(Merged);
}

/// <summary>
/// Event raised when a pull request mirrored from GitHub has been closed.
/// </summary>
/// <param name="Merged">Whether the pull request was merged rather than simply closed.</param>
[EventType]
public record PullRequestClosed(bool Merged);
