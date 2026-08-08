// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Comments.Recording;

/// <summary>
/// Command for recording a comment on an issue - mirroring a comment created on GitHub.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Comment">The identity of the comment on GitHub.</param>
/// <param name="Author">The login of the user that wrote the comment.</param>
/// <param name="Body">The markdown body of the comment.</param>
/// <param name="CommentedAt">When the comment was written on GitHub.</param>
[Command]
public record RecordIssueComment(IssueId Issue, CommentId Comment, UserName Author, CommentBody Body, DateTimeOffset CommentedAt)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueCommentAdded"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueCommentAdded Handle() => new(Comment, Author, Body, CommentedAt);
}

/// <summary>
/// Event raised when a comment has been added to an issue on GitHub.
/// </summary>
/// <param name="Comment">The identity of the comment on GitHub.</param>
/// <param name="Author">The login of the user that wrote the comment.</param>
/// <param name="Body">The markdown body of the comment.</param>
/// <param name="CommentedAt">When the comment was written on GitHub.</param>
[EventType]
public record IssueCommentAdded(CommentId Comment, UserName Author, CommentBody Body, DateTimeOffset CommentedAt);
