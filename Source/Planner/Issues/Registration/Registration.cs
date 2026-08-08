// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Registration;

/// <summary>
/// Command for registering an issue from GitHub in the Planner - the event-sourced mirror of the
/// issue, executed by the webhook receiver and the daily consolidation.
/// </summary>
/// <param name="Owner">The organization owning the repository the issue lives in.</param>
/// <param name="Repository">The repository the issue lives in.</param>
/// <param name="Number">The issue number.</param>
/// <param name="Title">The issue title.</param>
/// <param name="Type">The issue type as classified on GitHub.</param>
/// <param name="CreatedBy">The login of the user that created the issue.</param>
/// <param name="CreatedAt">When the issue was created on GitHub.</param>
/// <param name="AuthorAssociation">The author's association with the repository.</param>
/// <param name="IsOpen">Whether the issue is open on GitHub.</param>
/// <param name="Body">The markdown body of the issue - optional.</param>
/// <param name="Labels">The labels on the issue - optional.</param>
[Command]
public record RegisterIssue(
    OrganizationName Owner,
    RepositoryName Repository,
    IssueNumber Number,
    IssueTitle Title,
    IssueType Type,
    UserName CreatedBy,
    DateTimeOffset CreatedAt,
    AuthorAssociation AuthorAssociation,
    bool IsOpen,
    IssueBody? Body = null,
    IEnumerable<LabelName>? Labels = null)
{
    /// <summary>
    /// Handles the command by opening the issue's stream - keyed by the predictable
    /// <c>{org}-{repo}-{issue}</c> identity - and appending an <see cref="IssueRegistered"/> event.
    /// </summary>
    /// <returns>A tuple of the issue identity (event source) and the event.</returns>
    public (IssueId, IssueRegistered) Handle() =>
        (IssueId.From(Owner, Repository, Number),
         new(Owner, Repository, Number, Title, Type, CreatedBy, CreatedAt, AuthorAssociation, IsOpen, Body ?? IssueBody.NotSet, Labels ?? []));
}

/// <summary>
/// Represents the validator for the <see cref="RegisterIssue"/> command.
/// </summary>
public class RegisterIssueValidator : CommandValidator<RegisterIssue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RegisterIssueValidator"/> class.
    /// </summary>
    public RegisterIssueValidator()
    {
        RuleFor(_ => _.Owner).NotEmpty().WithMessage("An owner is required");
        RuleFor(_ => _.Repository).NotEmpty().WithMessage("A repository is required");
    }
}

/// <summary>
/// Event raised when an issue from GitHub has been registered in the Planner - the snapshot of the
/// issue at registration time; later changes arrive as their own facts.
/// </summary>
/// <param name="Owner">The organization owning the repository the issue lives in.</param>
/// <param name="Repository">The repository the issue lives in.</param>
/// <param name="Number">The issue number.</param>
/// <param name="Title">The issue title.</param>
/// <param name="Type">The issue type as classified on GitHub.</param>
/// <param name="CreatedBy">The login of the user that created the issue.</param>
/// <param name="CreatedAt">When the issue was created on GitHub - a business fact from GitHub, distinct from when it was registered here.</param>
/// <param name="AuthorAssociation">The author's association with the repository - used to decide whether an external issue should be investigated automatically.</param>
/// <param name="IsOpen">Whether the issue was open at registration time.</param>
/// <param name="Body">The markdown body of the issue - the not-set sentinel when it has none.</param>
/// <param name="Labels">The labels on the issue at registration time.</param>
[EventType]
public record IssueRegistered(
    OrganizationName Owner,
    RepositoryName Repository,
    IssueNumber Number,
    IssueTitle Title,
    IssueType Type,
    UserName CreatedBy,
    DateTimeOffset CreatedAt,
    AuthorAssociation AuthorAssociation,
    bool IsOpen,
    IssueBody Body,
    IEnumerable<LabelName> Labels);
