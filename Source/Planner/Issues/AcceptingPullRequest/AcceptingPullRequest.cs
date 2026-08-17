// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Planner.GitHub;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Issues.AcceptingPullRequest;

/// <summary>
/// Command for accepting the pull request associated with an issue - merges it through the GitHub API.
/// </summary>
/// <remarks>
/// Requires an authenticated operator: this merges agent-written code into a real repository.
/// </remarks>
/// <param name="Issue">The identity of the issue whose pull request is accepted.</param>
[Command]
[Authorize]
public record AcceptPullRequest(IssueId Issue)
{
    /// <summary>
    /// Handles the command by merging the associated pull request on GitHub. A missing association
    /// or a refusal from GitHub is a validation rejection, not an exception.
    /// </summary>
    /// <param name="issue">The issue's read model - resolved by the command's event source id.</param>
    /// <param name="gitHub">The <see cref="IGitHubClient"/> for talking to GitHub.</param>
    /// <returns>The <see cref="PullRequestMerged"/> event, or a validation error.</returns>
    public async Task<Result<PullRequestMerged, ValidationResult>> Handle(ListedIssue? issue, IGitHubClient gitHub)
    {
        if (issue?.PullRequest is null || issue.PullRequestOwner is null || issue.PullRequestRepository is null)
        {
            return ValidationResult.Error("The issue has no associated pull request");
        }

        var merged = await gitHub.MergePullRequest(issue.PullRequestOwner, issue.PullRequestRepository, issue.PullRequest);
        if (!merged)
        {
            return ValidationResult.Error("GitHub could not merge the pull request");
        }

        return new PullRequestMerged(issue.PullRequest);
    }
}

/// <summary>
/// Event raised when the pull request associated with an issue has been merged through the Planner.
/// </summary>
/// <param name="Number">The number of the merged pull request.</param>
[EventType]
public record PullRequestMerged(PullRequestNumber Number);
