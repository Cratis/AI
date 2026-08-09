// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.GitHub;
using Planner.Repositories.Adding;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Discovery;

/// <summary>
/// Reacts to an organization being added by discovering its repositories on GitHub and adding each of them.
/// </summary>
/// <param name="gitHub">The <see cref="IGitHubClient"/> for talking to GitHub.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="logger">The logger.</param>
public class RepositoryDiscovery(IGitHubClient gitHub, ICommandPipeline commandPipeline, ILogger<RepositoryDiscovery> logger) : IReactor
{
    /// <summary>
    /// Discovers and adds all repositories of the added organization, recording the outcome either way.
    /// </summary>
    /// <param name="event">The <see cref="OrganizationAdded"/> event.</param>
    /// <returns>The event recording how the discovery went.</returns>
    /// <remarks>
    /// Discovery needs a GitHub App installed on the account, which is a prerequisite the Planner cannot
    /// satisfy on its own. Letting the failure escape leaves the reactor retrying an operation that will
    /// never succeed, and leaves the organization sitting in the list looking like nothing was wrong.
    /// Recording it as a fact instead puts the reason on the organization for whoever added it to see.
    /// </remarks>
    public async Task<object> On(OrganizationAdded @event)
    {
        try
        {
            var repositories = (await gitHub.GetOrganizationRepositories(@event.Name)).ToList();
            foreach (var repository in repositories)
            {
                await commandPipeline.Execute(new AddRepository(repository.Owner, repository.Name));
            }

            return new OrganizationRepositoriesDiscovered(repositories.Count);
        }
        catch (Exception exception)
        {
            logger.RepositoryDiscoveryFailed(@event.Name, exception);
            return new OrganizationRepositoryDiscoveryFailed(exception.Message);
        }
    }
}

/// <summary>
/// Event raised when every repository of an organization has been discovered on GitHub and added.
/// </summary>
/// <param name="RepositoryCount">The number of repositories that were found.</param>
[EventType]
public record OrganizationRepositoriesDiscovered(int RepositoryCount);

/// <summary>
/// Event raised when the repositories of an organization could not be discovered on GitHub - typically
/// because no GitHub App is configured, or it is not installed on the account.
/// </summary>
/// <param name="Reason">Why the discovery failed, in the words of whatever refused it.</param>
[EventType]
public record OrganizationRepositoryDiscoveryFailed(string Reason);

/// <summary>
/// Log messages for repository discovery.
/// </summary>
internal static partial class DiscoveryLog
{
    [LoggerMessage(LogLevel.Error, "Could not discover the repositories of '{Organization}'")]
    internal static partial void RepositoryDiscoveryFailed(this ILogger logger, OrganizationName organization, Exception exception);
}
