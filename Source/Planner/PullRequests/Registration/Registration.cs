// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.PullRequests.Registration;

/// <summary>
/// Command for registering a pull request from GitHub in the Planner - the event-sourced mirror of
/// the pull request, executed by the webhook receiver when one is opened.
/// </summary>
/// <param name="Owner">The organization owning the repository the pull request lives in.</param>
/// <param name="Repository">The repository the pull request lives in.</param>
/// <param name="Number">The pull request number.</param>
/// <param name="Title">The pull request title.</param>
/// <param name="CreatedBy">The login of the user that opened the pull request.</param>
/// <param name="CreatedAt">When the pull request was opened on GitHub.</param>
/// <param name="Url">The URL of the pull request on GitHub.</param>
/// <param name="IsOpen">Whether the pull request is open - always <see langword="true"/> for a freshly opened pull request.</param>
[Command]
public record RegisterPullRequest(
    OrganizationName Owner,
    RepositoryName Repository,
    PullRequestNumber Number,
    PullRequestTitle Title,
    UserName CreatedBy,
    DateTimeOffset CreatedAt,
    PullRequestUrl Url,
    bool IsOpen)
{
    /// <summary>
    /// Handles the command by opening the pull request's stream - keyed by the predictable
    /// <c>{org}-{repo}-{number}</c> identity - and appending a <see cref="PullRequestRegistered"/> event.
    /// </summary>
    /// <returns>A tuple of the pull request identity (event source) and the event.</returns>
    public (PullRequestId, PullRequestRegistered) Handle() =>
        (PullRequestId.From(Owner, Repository, Number), new(Owner, Repository, Number, Title, CreatedBy, CreatedAt, Url, IsOpen));
}

/// <summary>
/// Represents the validator for the <see cref="RegisterPullRequest"/> command.
/// </summary>
public class RegisterPullRequestValidator : CommandValidator<RegisterPullRequest>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RegisterPullRequestValidator"/> class.
    /// </summary>
    public RegisterPullRequestValidator()
    {
        RuleFor(_ => _.Owner).NotEmpty().WithMessage("An owner is required");
        RuleFor(_ => _.Repository).NotEmpty().WithMessage("A repository is required");
    }
}

/// <summary>
/// Event raised when a pull request from GitHub has been registered in the Planner.
/// </summary>
/// <param name="Owner">The organization owning the repository the pull request lives in.</param>
/// <param name="Repository">The repository the pull request lives in.</param>
/// <param name="Number">The pull request number.</param>
/// <param name="Title">The pull request title.</param>
/// <param name="CreatedBy">The login of the user that opened the pull request.</param>
/// <param name="CreatedAt">When the pull request was opened on GitHub.</param>
/// <param name="Url">The URL of the pull request on GitHub.</param>
/// <param name="IsOpen">Whether the pull request was open at registration time.</param>
[EventType]
public record PullRequestRegistered(
    OrganizationName Owner,
    RepositoryName Repository,
    PullRequestNumber Number,
    PullRequestTitle Title,
    UserName CreatedBy,
    DateTimeOffset CreatedAt,
    PullRequestUrl Url,
    bool IsOpen);
