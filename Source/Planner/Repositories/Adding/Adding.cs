// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Adding;

/// <summary>
/// Command for adding a repository the Planner should track issues for.
/// </summary>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Name">The name of the repository.</param>
[Command]
public record AddRepository(OrganizationName Owner, RepositoryName Name)
{
    /// <summary>
    /// Handles the command by opening the repository's stream and appending a <see cref="RepositoryAdded"/> event.
    /// </summary>
    /// <returns>A tuple of the repository identity (event source) and the event.</returns>
    public (RepositoryId, RepositoryAdded) Handle() => (RepositoryId.From(Owner, Name), new(Owner, Name));
}

/// <summary>
/// Represents the validator for the <see cref="AddRepository"/> command.
/// </summary>
public class AddRepositoryValidator : CommandValidator<AddRepository>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddRepositoryValidator"/> class.
    /// </summary>
    public AddRepositoryValidator()
    {
        RuleFor(_ => _.Owner).NotEmpty().WithMessage("An owner is required");
        RuleFor(_ => _.Name).NotEmpty().WithMessage("A repository name is required");
    }
}

/// <summary>
/// Event raised when a repository has been added - from here on its issues are mirrored into the Planner.
/// </summary>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Name">The name of the repository.</param>
[EventType]
public record RepositoryAdded(OrganizationName Owner, RepositoryName Name);
