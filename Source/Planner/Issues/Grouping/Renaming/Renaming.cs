// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.Grouping.Renaming;

/// <summary>
/// Command for renaming a group of issues.
/// </summary>
/// <param name="Group">The identity of the group.</param>
/// <param name="Name">The new display name.</param>
[Command]
public record RenameGroup(GroupId Group, GroupName Name)
{
    /// <summary>
    /// Handles the command by appending a <see cref="GroupRenamed"/> event to the group's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public GroupRenamed Handle() => new(Name);
}

/// <summary>
/// Represents the validator for the <see cref="RenameGroup"/> command.
/// </summary>
public class RenameGroupValidator : CommandValidator<RenameGroup>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RenameGroupValidator"/> class.
    /// </summary>
    public RenameGroupValidator() => RuleFor(_ => _.Name).NotEmpty().WithMessage("A group name is required");
}

/// <summary>
/// Event raised when a group of issues has been renamed.
/// </summary>
/// <param name="Name">The new display name.</param>
[EventType]
public record GroupRenamed(GroupName Name);
