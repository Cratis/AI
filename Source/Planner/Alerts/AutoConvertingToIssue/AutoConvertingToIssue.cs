// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Alerts.ConvertingToIssue;
using Planner.GitHub;

namespace Planner.Alerts.AutoConvertingToIssue;

/// <summary>
/// Command for turning an alert an agent could not resolve into a GitHub issue automatically, in the
/// deployment's configured operational repository - which is not necessarily one the Planner tracks
/// (an infrastructure repository, say), so unlike <see cref="Planner.Alerts.ConvertingToIssue.ConvertAlertToIssue"/>
/// this writes straight to GitHub instead of requiring a tracked repository.
/// </summary>
/// <param name="Alert">The identity of the alert.</param>
/// <param name="Owner">The organization owning the repository to create the issue in.</param>
/// <param name="Repository">The repository to create the issue in.</param>
/// <param name="Title">The issue title.</param>
/// <param name="Body">The markdown body - the alert's own detail and what the agent found.</param>
[Command]
public record AutoConvertAlertToIssue(AlertId Alert, OrganizationName Owner, RepositoryName Repository, IssueTitle Title, IssueBody Body)
{
    /// <summary>
    /// Handles the command by creating the issue on GitHub. A refusal from GitHub is a validation
    /// rejection rather than an exception - a misconfigured operational repository is a normal
    /// mistake, not a broken Planner.
    /// </summary>
    /// <param name="gitHub">The <see cref="IGitHubClient"/> for talking to GitHub.</param>
    /// <returns>The <see cref="AlertConvertedToIssue"/> event, or a validation error.</returns>
    public async Task<Result<AlertConvertedToIssue, ValidationResult>> Handle(IGitHubClient gitHub)
    {
        var created = await gitHub.CreateIssue(Owner, Repository, Title, $"{Body.Value}{AIIdentity.Footer()}");
        if (created is null)
        {
            return ValidationResult.Error($"GitHub would not create an issue in {Owner.Value}/{Repository.Value}");
        }

        return new AlertConvertedToIssue(created.Number, created.Url, Owner, Repository);
    }
}

/// <summary>
/// Represents the validator for the <see cref="AutoConvertAlertToIssue"/> command.
/// </summary>
public class AutoConvertAlertToIssueValidator : CommandValidator<AutoConvertAlertToIssue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AutoConvertAlertToIssueValidator"/> class.
    /// </summary>
    public AutoConvertAlertToIssueValidator()
    {
        RuleFor(_ => _.Owner).NotEmpty().WithMessage("An owner is required");
        RuleFor(_ => _.Repository).NotEmpty().WithMessage("A repository is required");
        RuleFor(_ => _.Title).NotEqual(IssueTitle.NotSet).WithMessage("An issue needs a title");
    }
}
