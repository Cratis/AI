// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.PullRequests.Closing;
using Planner.PullRequests.Registration;
using Planner.PullRequests.Reopening;

namespace Planner.PullRequests.Listing;

/// <summary>
/// Read model for the pull request list - every pull request mirrored from GitHub across the
/// Planner's tracked repositories, kept current by the GitHub webhook.
/// </summary>
/// <param name="Id">The pull request identity - the predictable <c>{org}-{repo}-{number}</c> key.</param>
/// <param name="Owner">The organization owning the repository the pull request lives in.</param>
/// <param name="Repository">The repository the pull request lives in.</param>
/// <param name="Number">The pull request number.</param>
/// <param name="Title">The pull request title.</param>
/// <param name="CreatedBy">The login of the user that opened the pull request.</param>
/// <param name="CreatedAt">When the pull request was opened on GitHub.</param>
/// <param name="Url">The URL of the pull request on GitHub.</param>
/// <param name="IsOpen">Whether the pull request is currently open.</param>
/// <param name="Merged">Whether the pull request was merged - <see langword="null"/> until it closes.</param>
[ReadModel]
[FromEvent<PullRequestRegistered>]
public record PullRequest(
    PullRequestId Id,
    OrganizationName Owner,
    RepositoryName Repository,
    PullRequestNumber Number,
    PullRequestTitle Title,
    UserName CreatedBy,
    DateTimeOffset CreatedAt,
    PullRequestUrl Url,
    [SetValue<PullRequestClosed>(false)]
    [SetValue<PullRequestReopened>(true)]
    bool IsOpen,
    [SetFrom<PullRequestClosed>(nameof(PullRequestClosed.Merged))]
    bool? Merged = null)
{
    /// <summary>
    /// Observes every pull request mirrored across every tracked repository, open, merged and
    /// closed alike - the history view behind the "Show done" toggle. <see cref="OpenPullRequests"/>
    /// is what the default view uses.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the pull requests.</param>
    /// <returns>An observable of every pull request.</returns>
    public static ISubject<IEnumerable<PullRequest>> AllPullRequests(IMongoCollection<PullRequest> collection) =>
        collection.Observe();

    /// <summary>
    /// Observes the pull requests that are still open on GitHub - the default view, so a merged or
    /// closed pull request disappears the moment the mirror learns about it.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the pull requests.</param>
    /// <returns>An observable of the open pull requests.</returns>
    public static ISubject<IEnumerable<PullRequest>> OpenPullRequests(IMongoCollection<PullRequest> collection) =>
        collection.Observe(pullRequest => pullRequest.IsOpen);
}
