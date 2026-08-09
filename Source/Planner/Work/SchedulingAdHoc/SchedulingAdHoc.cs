// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Identity;
using Planner.Repositories.Listing;

namespace Planner.Work.SchedulingAdHoc;

/// <summary>
/// Command for scheduling ad-hoc agent work - a free-form prompt over one or more repositories, a
/// whole organization, or a repository group (the frontend expands a group to its repositories).
/// </summary>
/// <param name="Prompt">The instructions for the agent.</param>
/// <param name="Repositories">The identities of the repositories to work with - optional when an organization is given.</param>
/// <param name="Organization">Work with every tracked repository of this organization - optional.</param>
/// <param name="Model">The model to use - optional; falls back to the configured default.</param>
[Command]
public record ScheduleAdHocWork(
    WorkPrompt Prompt,
    IEnumerable<RepositoryId>? Repositories = null,
    OrganizationName? Organization = null,
    ModelName? Model = null)
{
    /// <summary>
    /// Resolves the repositories the work covers - the explicitly selected ones plus, when an
    /// organization is given, every tracked repository of that organization.
    /// </summary>
    /// <param name="repositories">The repository read models.</param>
    /// <returns>The resolved repository identities, or a validation error when nothing resolves.</returns>
    public async Task<Result<IReadOnlyList<RepositoryId>, ValidationResult>> Provide(IMongoCollection<Repository> repositories)
    {
        var resolved = (Repositories ?? []).ToList();
        var organization = Organization ?? OrganizationName.NotSet;
        if (organization != OrganizationName.NotSet)
        {
            var cursor = await repositories.FindAsync(repository => repository.Owner == organization);
            resolved.AddRange((await cursor.ToListAsync()).Select(repository => repository.Id));
        }

        resolved = [.. resolved.Distinct()];
        if (resolved.Count == 0)
        {
            return ValidationResult.Error("Select at least one repository or an organization with tracked repositories");
        }

        return resolved;
    }

    /// <summary>
    /// Handles the command by opening a new work stream and appending an <see cref="AdHocWorkScheduled"/> event.
    /// </summary>
    /// <param name="resolvedRepositories">The resolved repositories from <see cref="Provide"/>.</param>
    /// <param name="currentUser">The <see cref="ICurrentUser"/> scheduling the work, when there is one.</param>
    /// <returns>A tuple of the work identity (event source) and the event.</returns>
    public (WorkId, AdHocWorkScheduled) Handle(IReadOnlyList<RepositoryId> resolvedRepositories, ICurrentUser currentUser) =>
        (WorkId.New(), new(Prompt, resolvedRepositories, [], Model ?? ModelName.NotSet, currentUser.GetUserName()));
}

/// <summary>
/// Represents the validator for the <see cref="ScheduleAdHocWork"/> command.
/// </summary>
public class ScheduleAdHocWorkValidator : CommandValidator<ScheduleAdHocWork>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ScheduleAdHocWorkValidator"/> class.
    /// </summary>
    public ScheduleAdHocWorkValidator() => RuleFor(_ => _.Prompt).NotEmpty().WithMessage("A prompt is required");
}

/// <summary>
/// Event raised when ad-hoc agent work has been scheduled over a set of repositories - it waits
/// until the scheduler finds an account with capacity.
/// </summary>
/// <param name="Prompt">The instructions for the agent.</param>
/// <param name="Repositories">The identities of the repositories the work covers.</param>
/// <param name="Issues">Ad-hoc work covers no issues - always empty; carried so every unit of work has the same shape.</param>
/// <param name="Model">The model to use - <see cref="ModelName.NotSet"/> when the scheduler should decide.</param>
/// <param name="RequestedBy">The login of the user that scheduled the work - <see cref="UserName.NotSet"/> for automation.</param>
[EventType]
public record AdHocWorkScheduled(
    WorkPrompt Prompt,
    IEnumerable<RepositoryId> Repositories,
    IEnumerable<IssueId> Issues,
    ModelName Model,
    UserName RequestedBy);
