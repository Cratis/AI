// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Groups.Changing;

/// <summary>
/// Command for changing the members of a repository group - the full member set travels as one fact.
/// </summary>
/// <param name="Group">The identity of the group.</param>
/// <param name="Repositories">The identities of the repositories the group now holds.</param>
[Command]
public record ChangeRepositoryGroup(RepositoryGroupId Group, IEnumerable<RepositoryId> Repositories)
{
    /// <summary>
    /// Handles the command by appending a <see cref="RepositoryGroupMembersChanged"/> event to the group's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public RepositoryGroupMembersChanged Handle() => new(Repositories);
}

/// <summary>
/// Represents the validator for the <see cref="ChangeRepositoryGroup"/> command.
/// </summary>
public class ChangeRepositoryGroupValidator : CommandValidator<ChangeRepositoryGroup>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ChangeRepositoryGroupValidator"/> class.
    /// </summary>
    public ChangeRepositoryGroupValidator() => RuleFor(_ => _.Repositories).NotEmpty().WithMessage("A group needs at least one repository");
}

/// <summary>
/// Event raised when the members of a repository group have changed - carries the full resulting set.
/// </summary>
/// <param name="Repositories">The identities of the repositories the group now holds.</param>
[EventType]
public record RepositoryGroupMembersChanged(IEnumerable<RepositoryId> Repositories);
