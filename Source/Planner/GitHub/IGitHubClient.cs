// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub;

/// <summary>
/// Defines the Planner's client for the GitHub REST API.
/// </summary>
public interface IGitHubClient
{
    /// <summary>
    /// Gets all repositories for an organization.
    /// </summary>
    /// <param name="organization">The organization to get repositories for.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The repositories of the organization.</returns>
    Task<IEnumerable<GitHubRepository>> GetOrganizationRepositories(OrganizationName organization, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all issues for a repository, paging through the full set. Pull requests are excluded.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="repository">The repository to get issues for.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The issues of the repository.</returns>
    Task<IEnumerable<GitHubIssue>> GetIssues(OrganizationName owner, RepositoryName repository, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all comments for an issue, paging through the full set.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="repository">The repository the issue belongs to.</param>
    /// <param name="number">The issue number.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The comments of the issue.</returns>
    Task<IEnumerable<GitHubComment>> GetIssueComments(OrganizationName owner, RepositoryName repository, IssueNumber number, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates an issue in a repository.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="repository">The repository to create the issue in.</param>
    /// <param name="title">The issue title.</param>
    /// <param name="body">The markdown body of the issue.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The created issue, or <see langword="null"/> when GitHub refused to create it.</returns>
    Task<GitHubCreatedIssue?> CreateIssue(OrganizationName owner, RepositoryName repository, IssueTitle title, IssueBody body, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a comment to an issue.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="repository">The repository the issue belongs to.</param>
    /// <param name="number">The issue number.</param>
    /// <param name="comment">The markdown body of the comment.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task AddIssueComment(OrganizationName owner, RepositoryName repository, IssueNumber number, string comment, CancellationToken cancellationToken = default);

    /// <summary>
    /// Merges a pull request.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="repository">The repository the pull request belongs to.</param>
    /// <param name="number">The pull request number.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns><see langword="true"/> when the pull request was merged; otherwise <see langword="false"/>.</returns>
    Task<bool> MergePullRequest(OrganizationName owner, RepositoryName repository, PullRequestNumber number, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks whether a user is a member of an organization.
    /// </summary>
    /// <param name="organization">The organization to check membership in.</param>
    /// <param name="user">The user to check.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns><see langword="true"/> when the user is a member; otherwise <see langword="false"/>.</returns>
    Task<bool> IsOrganizationMember(OrganizationName organization, UserName user, CancellationToken cancellationToken = default);
}
