// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Repositories.Adding;

namespace Planner.GitHub.Synchronization;

/// <summary>
/// Reacts to a repository being added by loading all of its issues from GitHub - the initial load
/// that seeds the mirror before webhooks keep it current.
/// </summary>
/// <param name="synchronizer">The <see cref="IIssueSynchronizer"/> doing the work.</param>
public class AddedRepositorySynchronization(IIssueSynchronizer synchronizer) : IReactor
{
    /// <summary>
    /// Synchronizes the added repository's issues.
    /// </summary>
    /// <param name="event">The <see cref="RepositoryAdded"/> event.</param>
    /// <returns>Awaitable task.</returns>
    public Task On(RepositoryAdded @event) => synchronizer.SynchronizeRepository(@event.Owner, @event.Name);
}
