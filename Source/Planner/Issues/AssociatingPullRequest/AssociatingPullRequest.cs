// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.AssociatingPullRequest;

/// <summary>
/// Command for associating a pull request with an issue - executed when work on the issue has
/// produced a pull request that awaits review.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Number">The pull request number.</param>
/// <param name="Url">The html URL of the pull request on GitHub.</param>
/// <param name="PullRequestOwner">The organization owning the repository the pull request was opened in.</param>
/// <param name="PullRequestRepository">The repository the pull request was opened in - the code repository, which may differ from the issue's repository.</param>
[Command]
public record AssociatePullRequest(
    IssueId Issue,
    PullRequestNumber Number,
    PullRequestUrl Url,
    OrganizationName PullRequestOwner,
    RepositoryName PullRequestRepository)
{
    /// <summary>
    /// Handles the command by appending a <see cref="PullRequestAssociated"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public PullRequestAssociated Handle() => new(Number, Url, PullRequestOwner, PullRequestRepository);
}

/// <summary>
/// Represents the validator for the <see cref="AssociatePullRequest"/> command.
/// </summary>
public class AssociatePullRequestValidator : CommandValidator<AssociatePullRequest>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AssociatePullRequestValidator"/> class.
    /// </summary>
    public AssociatePullRequestValidator()
    {
        RuleFor(_ => _.PullRequestOwner).NotEmpty().WithMessage("The pull request owner is required");
        RuleFor(_ => _.PullRequestRepository).NotEmpty().WithMessage("The pull request repository is required");
    }
}

/// <summary>
/// Event raised when a pull request has been associated with an issue - the issue can now be
/// reviewed and the pull request accepted from the Planner.
/// </summary>
/// <param name="Number">The pull request number.</param>
/// <param name="Url">The html URL of the pull request on GitHub.</param>
/// <param name="PullRequestOwner">The organization owning the repository the pull request was opened in.</param>
/// <param name="PullRequestRepository">The repository the pull request was opened in.</param>
[EventType]
public record PullRequestAssociated(
    PullRequestNumber Number,
    PullRequestUrl Url,
    OrganizationName PullRequestOwner,
    RepositoryName PullRequestRepository);
