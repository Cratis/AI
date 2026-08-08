// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Comments.Removing;

/// <summary>
/// Command for removing a comment from an issue - mirroring a comment deletion on GitHub.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Comment">The identity of the comment on GitHub.</param>
[Command]
public record RemoveIssueComment(IssueId Issue, CommentId Comment)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueCommentRemoved"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueCommentRemoved Handle() => new(Comment);
}

/// <summary>
/// Event raised when a comment has been removed from an issue on GitHub.
/// </summary>
/// <param name="Comment">The identity of the comment on GitHub.</param>
[EventType]
public record IssueCommentRemoved(CommentId Comment);
