// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.MappingCodeRepository;

/// <summary>
/// Command for mapping the repository the code lives in for a repository that only tracks issues.
/// Some issue repositories are public fronts for private code repositories - for instance the public
/// StudioIssues repository tracking issues for the private Studio repository.
/// </summary>
/// <param name="Repository">The identity of the issues repository.</param>
/// <param name="CodeOwner">The organization owning the code repository.</param>
/// <param name="CodeName">The name of the code repository.</param>
[Command]
public record MapCodeRepository(RepositoryId Repository, OrganizationName CodeOwner, RepositoryName CodeName)
{
    /// <summary>
    /// Handles the command by appending a <see cref="CodeRepositoryMapped"/> event to the repository's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public CodeRepositoryMapped Handle() => new(CodeOwner, CodeName);
}

/// <summary>
/// Represents the validator for the <see cref="MapCodeRepository"/> command.
/// </summary>
public class MapCodeRepositoryValidator : CommandValidator<MapCodeRepository>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="MapCodeRepositoryValidator"/> class.
    /// </summary>
    public MapCodeRepositoryValidator()
    {
        RuleFor(_ => _.CodeOwner).NotEmpty().WithMessage("A code repository owner is required");
        RuleFor(_ => _.CodeName).NotEmpty().WithMessage("A code repository name is required");
    }
}

/// <summary>
/// Event raised when the code repository has been mapped for an issues repository - work scheduled
/// for issues in this repository clones and operates on the mapped code repository instead.
/// </summary>
/// <param name="CodeOwner">The organization owning the code repository.</param>
/// <param name="CodeName">The name of the code repository.</param>
[EventType]
public record CodeRepositoryMapped(OrganizationName CodeOwner, RepositoryName CodeName);
