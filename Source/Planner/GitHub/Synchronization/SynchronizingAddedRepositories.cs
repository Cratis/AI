// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Repositories.Adding;

namespace Planner.GitHub.Synchronization;

/// <summary>
/// Reacts to a repository being added by loading all of its issues from GitHub - the initial load
/// that seeds the mirror before webhooks keep it current.
/// </summary>
/// <param name="synchronizer">The <see cref="IIssueSynchronizer"/> doing the work.</param>
/// <param name="logger">The logger.</param>
public class AddedRepositorySynchronization(IIssueSynchronizer synchronizer, ILogger<AddedRepositorySynchronization> logger) : IReactor
{
    /// <summary>
    /// Synchronizes the added repository's issues, recording the outcome either way.
    /// </summary>
    /// <param name="event">The <see cref="RepositoryAdded"/> event.</param>
    /// <returns>The event recording how the initial load went.</returns>
    /// <remarks>
    /// The initial load needs GitHub credentials the Planner cannot grant itself. Recording a failure as a
    /// fact keeps a repository whose issues never loaded from looking identical to one that loaded fine.
    /// </remarks>
    public async Task<object> On(RepositoryAdded @event)
    {
        try
        {
            await synchronizer.SynchronizeRepository(@event.Owner, @event.Name);
            return new RepositoryIssuesSynchronized();
        }
        catch (Exception exception)
        {
            logger.InitialSynchronizationFailed(@event.Owner, @event.Name, exception);
            return new RepositoryIssueSynchronizationFailed(exception.Message);
        }
    }
}

/// <summary>
/// Event raised when the issues of a repository have been mirrored from GitHub.
/// </summary>
[EventType]
public record RepositoryIssuesSynchronized;

/// <summary>
/// Event raised when the issues of a repository could not be mirrored from GitHub - typically because no
/// GitHub App is configured, or it is not installed on the account owning the repository.
/// </summary>
/// <param name="Reason">Why the synchronization failed, in the words of whatever refused it.</param>
[EventType]
public record RepositoryIssueSynchronizationFailed(string Reason);
