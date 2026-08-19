// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.GitHub;
using Planner.Identity;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Issues.Comments.Replying;

/// <summary>
/// Command for replying to an issue from the Planner's inbox - posts the comment to GitHub as the
/// Planner's own identity, attributed to the signed-in user, since the Planner authenticates as a
/// GitHub App rather than as the person. The mirror then picks the comment back up through the
/// regular <c>issue_comment</c> webhook, so it shows up on the issue like any other.
/// </summary>
/// <param name="Issue">The identity of the issue to reply to.</param>
/// <param name="Text">The markdown body of the reply.</param>
[Command]
public record ReplyToIssue(IssueId Issue, CommentBody Text)
{
    /// <summary>
    /// Handles the command by posting the comment to GitHub. An unknown issue is a validation
    /// rejection rather than an exception.
    /// </summary>
    /// <param name="issue">The issue's read model - resolved by the command's event source id.</param>
    /// <param name="gitHub">The <see cref="IGitHubClient"/> for posting the comment.</param>
    /// <param name="currentUser">The <see cref="ICurrentUser"/> replying.</param>
    /// <returns>Successful, or a validation error.</returns>
    public async Task<Result<ValidationResult>> Handle(ListedIssue? issue, IGitHubClient gitHub, ICurrentUser currentUser)
    {
        if (issue is null || issue.Owner == OrganizationName.NotSet)
        {
            return ValidationResult.Error("That issue is not known");
        }

        var by = currentUser.GetUserName();
        var attribution = by == UserName.NotSet ? string.Empty : $"\n\n_Reply from {by.Value} via the Planner._";
        await gitHub.AddIssueComment(issue.Owner, issue.Repository, issue.Number, $"{Text.Value}{attribution}{AIIdentity.Footer()}");

        return Result.Success<ValidationResult>();
    }
}

/// <summary>
/// Represents the validator for the <see cref="ReplyToIssue"/> command.
/// </summary>
public class ReplyToIssueValidator : CommandValidator<ReplyToIssue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReplyToIssueValidator"/> class.
    /// </summary>
    public ReplyToIssueValidator() => RuleFor(_ => _.Text).NotEmpty().WithMessage("A reply needs some text");
}
