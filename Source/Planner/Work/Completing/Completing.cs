// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Completing;

/// <summary>
/// Command for recording that a unit of implementation work completed - executed when the worker
/// container reports back.
/// </summary>
/// <param name="Work">The identity of the work.</param>
/// <param name="Summary">The summary the worker reported.</param>
/// <param name="PullRequest">The pull request the work produced - optional; not all work ends in one.</param>
/// <param name="PullRequestUrl">The html URL of the pull request.</param>
/// <param name="PullRequestOwner">The organization owning the repository the pull request was opened in.</param>
/// <param name="PullRequestRepository">The repository the pull request was opened in.</param>
[Command]
public record CompleteWork(
    WorkId Work,
    WorkSummary Summary,
    PullRequestNumber? PullRequest = null,
    PullRequestUrl? PullRequestUrl = null,
    OrganizationName? PullRequestOwner = null,
    RepositoryName? PullRequestRepository = null)
{
    /// <summary>
    /// Handles the command by appending a <see cref="WorkCompleted"/> event to the work's stream,
    /// resolving absent pull request information to the not-set sentinels.
    /// </summary>
    /// <returns>The event.</returns>
    public WorkCompleted Handle() => new(
        Summary,
        PullRequest ?? PullRequestNumber.NotSet,
        PullRequestUrl ?? Common.PullRequestUrl.NotSet,
        PullRequestOwner ?? OrganizationName.NotSet,
        PullRequestRepository ?? RepositoryName.NotSet);
}

/// <summary>
/// Event raised when a unit of implementation work completed. When the work produced a pull
/// request, its coordinates travel on the event so the covered issues can be marked for review.
/// </summary>
/// <param name="Summary">The summary the worker reported.</param>
/// <param name="PullRequest">The pull request number - <see cref="PullRequestNumber.NotSet"/> when none was produced.</param>
/// <param name="PullRequestUrl">The html URL of the pull request.</param>
/// <param name="PullRequestOwner">The organization owning the repository the pull request was opened in.</param>
/// <param name="PullRequestRepository">The repository the pull request was opened in.</param>
[EventType]
public record WorkCompleted(
    WorkSummary Summary,
    PullRequestNumber PullRequest,
    PullRequestUrl PullRequestUrl,
    OrganizationName PullRequestOwner,
    RepositoryName PullRequestRepository);
