// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Builds;

namespace Planner.GitHub;

/// <summary>
/// Represents a repository as returned by the GitHub API.
/// </summary>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Name">The name of the repository.</param>
/// <param name="IsPrivate">Whether the repository is private.</param>
public record GitHubRepository(OrganizationName Owner, RepositoryName Name, bool IsPrivate);

/// <summary>
/// Represents an issue as returned by the GitHub API.
/// </summary>
/// <param name="Number">The issue number.</param>
/// <param name="Title">The issue title.</param>
/// <param name="Type">The issue type, such as <c>Bug</c> or <c>Feature</c> - empty when the repository does not use types.</param>
/// <param name="CreatedBy">The login of the user that created the issue.</param>
/// <param name="CreatedAt">When the issue was created on GitHub.</param>
/// <param name="AuthorAssociation">The author's association with the repository, such as <c>MEMBER</c> or <c>NONE</c>.</param>
/// <param name="IsOpen">Whether the issue is open.</param>
/// <param name="Body">The markdown body of the issue.</param>
/// <param name="Labels">The labels on the issue.</param>
/// <param name="CommentCount">The number of comments on the issue.</param>
public record GitHubIssue(
    IssueNumber Number,
    IssueTitle Title,
    IssueType Type,
    UserName CreatedBy,
    DateTimeOffset CreatedAt,
    AuthorAssociation AuthorAssociation,
    bool IsOpen,
    IssueBody Body,
    IEnumerable<LabelName> Labels,
    int CommentCount);

/// <summary>
/// Represents an issue just created through the GitHub API.
/// </summary>
/// <param name="Number">The number GitHub assigned the issue.</param>
/// <param name="Url">The html URL of the issue.</param>
public record GitHubCreatedIssue(IssueNumber Number, IssueUrl Url);

/// <summary>
/// Represents a comment on an issue as returned by the GitHub API.
/// </summary>
/// <param name="Id">The identity of the comment.</param>
/// <param name="Author">The login of the user that wrote the comment.</param>
/// <param name="Body">The markdown body of the comment.</param>
/// <param name="CommentedAt">When the comment was written.</param>
public record GitHubComment(CommentId Id, UserName Author, CommentBody Body, DateTimeOffset CommentedAt);

/// <summary>
/// Represents the most recent run of a workflow as returned by the GitHub Actions API.
/// </summary>
/// <param name="Workflow">The workflow's name.</param>
/// <param name="Conclusion">How the run concluded - <see cref="BuildConclusion.Unknown"/> for a run still in progress.</param>
/// <param name="RunUrl">The html URL of the run.</param>
/// <param name="RanAt">When the run finished, or was last updated while still running.</param>
public record GitHubWorkflowRun(WorkflowName Workflow, BuildConclusion Conclusion, BuildRunUrl RunUrl, DateTimeOffset RanAt);
