// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.GitHub;
using TrackedRepository = Planner.Repositories.Listing.Repository;

namespace Planner.Alerts.ConvertingToIssue;

/// <summary>
/// Command for turning an alert into a GitHub issue - the move for a condition that is not going to
/// be fixed by an agent poking at production, but by someone changing the code. The alert keeps its
/// own life on the board; the issue is where the work happens.
/// </summary>
/// <param name="Alert">The identity of the alert.</param>
/// <param name="Repository">The tracked repository to create the issue in.</param>
/// <param name="Title">The issue title.</param>
/// <param name="Body">The markdown body - the alert's own detail, what the agent found, and anything the user added.</param>
[Command]
public record ConvertAlertToIssue(AlertId Alert, RepositoryId Repository, IssueTitle Title, IssueBody Body)
{
    /// <summary>
    /// Handles the command by creating the issue on GitHub. Both an unknown repository and a refusal
    /// from GitHub are validation rejections rather than exceptions - a repository the App cannot
    /// write to is a normal mistake, not a broken Planner.
    /// </summary>
    /// <param name="readModels">The <see cref="IReadModels"/> for resolving the repository by its identity.</param>
    /// <param name="gitHub">The <see cref="IGitHubClient"/> for talking to GitHub.</param>
    /// <returns>The <see cref="AlertConvertedToIssue"/> event, or a validation error.</returns>
    /// <remarks>
    /// The issue goes to the tracked repository itself rather than to any code repository mapped to
    /// it: the mapping exists so agents clone the right source, while issues are tracked where the
    /// organization tracks them. Creating it here also means the Planner mirrors the issue back on
    /// GitHub's own <c>issues</c> webhook, so it appears on the issue board without a second write.
    /// </remarks>
    public async Task<Result<AlertConvertedToIssue, ValidationResult>> Handle(IReadModels readModels, IGitHubClient gitHub)
    {
        // The repository read model carries [RemovedWith], so an unknown one resolves to a
        // default-initialized instance rather than null - an empty owner is what "not tracked" is.
        var repository = await readModels.GetInstanceById<TrackedRepository>((EventSourceId)Repository);
        if (repository is null || repository.Owner == OrganizationName.NotSet)
        {
            return ValidationResult.Error("That repository is not tracked by the Planner");
        }

        var created = await gitHub.CreateIssue(repository.Owner, repository.Name, Title, Body);
        if (created is null)
        {
            return ValidationResult.Error($"GitHub would not create an issue in {repository.Owner.Value}/{repository.Name.Value}");
        }

        return new AlertConvertedToIssue(created.Number, created.Url, repository.Owner, repository.Name);
    }
}

/// <summary>
/// Represents the validator for the <see cref="ConvertAlertToIssue"/> command.
/// </summary>
public class ConvertAlertToIssueValidator : CommandValidator<ConvertAlertToIssue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ConvertAlertToIssueValidator"/> class.
    /// </summary>
    public ConvertAlertToIssueValidator()
    {
        RuleFor(_ => _.Repository).NotEqual(RepositoryId.NotSet).WithMessage("Pick the repository to create the issue in");
        RuleFor(_ => _.Title).NotEqual(IssueTitle.NotSet).WithMessage("An issue needs a title");
    }
}

/// <summary>
/// Event raised when an alert has been turned into a GitHub issue.
/// </summary>
/// <param name="Number">The number GitHub assigned the issue.</param>
/// <param name="Url">The html URL of the issue.</param>
/// <param name="Owner">The organization owning the repository the issue was created in.</param>
/// <param name="Repository">The repository the issue was created in.</param>
[EventType]
public record AlertConvertedToIssue(IssueNumber Number, IssueUrl Url, OrganizationName Owner, RepositoryName Repository);
