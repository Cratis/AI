// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub;

/// <summary>
/// Represents a repository as returned by the GitHub API.
/// </summary>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Name">The name of the repository.</param>
/// <param name="IsPrivate">Whether the repository is private.</param>
public record GitHubRepository(OrganizationName Owner, RepositoryName Name, bool IsPrivate);

/// <summary>
/// Represents the vitals of an issue as returned by the GitHub API.
/// </summary>
/// <param name="Number">The issue number.</param>
/// <param name="Title">The issue title.</param>
/// <param name="Type">The issue type, such as <c>Bug</c> or <c>Feature</c> - empty when the repository does not use types.</param>
/// <param name="CreatedBy">The login of the user that created the issue.</param>
/// <param name="CreatedAt">When the issue was created on GitHub.</param>
/// <param name="AuthorAssociation">The author's association with the repository, such as <c>MEMBER</c> or <c>NONE</c>.</param>
/// <param name="IsOpen">Whether the issue is open.</param>
public record GitHubIssue(
    IssueNumber Number,
    IssueTitle Title,
    IssueType Type,
    UserName CreatedBy,
    DateTimeOffset CreatedAt,
    AuthorAssociation AuthorAssociation,
    bool IsOpen);

/// <summary>
/// Represents the details of an issue, including its markdown body.
/// </summary>
/// <param name="Issue">The issue vitals.</param>
/// <param name="Body">The markdown body of the issue.</param>
/// <param name="Url">The html URL of the issue on GitHub.</param>
public record GitHubIssueDetails(GitHubIssue Issue, string Body, string Url);
