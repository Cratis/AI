// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Groups.Creating;

/// <summary>
/// Command for creating a named group of repositories - selectable as a unit when scheduling
/// ad-hoc work.
/// </summary>
/// <param name="Name">The display name of the group.</param>
/// <param name="Repositories">The identities of the repositories in the group.</param>
[Command]
public record CreateRepositoryGroup(RepositoryGroupName Name, IEnumerable<RepositoryId> Repositories)
{
    /// <summary>
    /// Handles the command by opening a new group stream and appending a <see cref="RepositoryGroupCreated"/> event.
    /// </summary>
    /// <returns>A tuple of the group identity (event source) and the event.</returns>
    public (RepositoryGroupId, RepositoryGroupCreated) Handle() => (RepositoryGroupId.New(), new(Name, Repositories));
}

/// <summary>
/// Represents the validator for the <see cref="CreateRepositoryGroup"/> command.
/// </summary>
public class CreateRepositoryGroupValidator : CommandValidator<CreateRepositoryGroup>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="CreateRepositoryGroupValidator"/> class.
    /// </summary>
    public CreateRepositoryGroupValidator()
    {
        RuleFor(_ => _.Name).NotEmpty().WithMessage("A group name is required");
        RuleFor(_ => _.Repositories).NotEmpty().WithMessage("A group needs at least one repository");
    }
}

/// <summary>
/// Event raised when a named group of repositories has been created.
/// </summary>
/// <param name="Name">The display name of the group.</param>
/// <param name="Repositories">The identities of the repositories in the group.</param>
[EventType]
public record RepositoryGroupCreated(RepositoryGroupName Name, IEnumerable<RepositoryId> Repositories);
