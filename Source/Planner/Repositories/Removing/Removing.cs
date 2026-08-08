// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Removing;

/// <summary>
/// Command for removing a repository from the Planner.
/// </summary>
/// <param name="Repository">The identity of the repository to remove.</param>
[Command]
public record RemoveRepository(RepositoryId Repository)
{
    /// <summary>
    /// Handles the command by appending a <see cref="RepositoryRemoved"/> event to the repository's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public RepositoryRemoved Handle() => new();
}

/// <summary>
/// Event raised when a repository has been removed - its issues are no longer mirrored.
/// </summary>
[EventType]
public record RepositoryRemoved;
