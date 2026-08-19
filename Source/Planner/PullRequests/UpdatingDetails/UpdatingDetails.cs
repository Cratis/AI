// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.PullRequests.UpdatingDetails;

/// <summary>
/// Command for updating the details of a pull request mirrored from GitHub - body, labels, draft
/// state and branches. Every pull request webhook delivery carries the full current state of these,
/// regardless of which action triggered it, so this is applied unconditionally rather than
/// separately per action (<c>edited</c>, <c>labeled</c>, <c>unlabeled</c>, <c>synchronize</c>,
/// <c>ready_for_review</c>, <c>converted_to_draft</c>).
/// </summary>
/// <param name="PullRequest">The identity of the pull request.</param>
/// <param name="Body">The markdown body of the pull request.</param>
/// <param name="Labels">The labels on the pull request.</param>
/// <param name="Draft">Whether the pull request is a draft.</param>
/// <param name="HeadBranch">The branch the pull request merges from.</param>
/// <param name="BaseBranch">The branch the pull request merges into.</param>
[Command]
public record UpdatePullRequestDetails(
    PullRequestId PullRequest,
    PullRequestBody Body,
    IEnumerable<LabelName> Labels,
    bool Draft,
    BranchName HeadBranch,
    BranchName BaseBranch)
{
    /// <summary>
    /// Handles the command by appending a <see cref="PullRequestDetailsChanged"/> event to the pull
    /// request's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public PullRequestDetailsChanged Handle() => new(Body, Labels, Draft, HeadBranch, BaseBranch);
}

/// <summary>
/// Event raised when the details of a pull request mirrored from GitHub have changed.
/// </summary>
/// <param name="Body">The markdown body of the pull request.</param>
/// <param name="Labels">The labels on the pull request.</param>
/// <param name="Draft">Whether the pull request is a draft.</param>
/// <param name="HeadBranch">The branch the pull request merges from.</param>
/// <param name="BaseBranch">The branch the pull request merges into.</param>
[EventType]
public record PullRequestDetailsChanged(
    PullRequestBody Body,
    IEnumerable<LabelName> Labels,
    bool Draft,
    BranchName HeadBranch,
    BranchName BaseBranch);
