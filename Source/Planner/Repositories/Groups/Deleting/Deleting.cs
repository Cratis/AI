// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Groups.Deleting;

/// <summary>
/// Command for deleting a repository group.
/// </summary>
/// <param name="Group">The identity of the group to delete.</param>
[Command]
public record DeleteRepositoryGroup(RepositoryGroupId Group)
{
    /// <summary>
    /// Handles the command by appending a <see cref="RepositoryGroupDeleted"/> event to the group's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public RepositoryGroupDeleted Handle() => new();
}

/// <summary>
/// Event raised when a repository group has been deleted.
/// </summary>
[EventType]
public record RepositoryGroupDeleted;
