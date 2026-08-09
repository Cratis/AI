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
public class RepositoryDiscovery(IGitHubClient gitHub, ICommandPipeline commandPipeline) : IReactor
{
    /// <summary>
    /// Discovers and adds all repositories of the added organization.
    /// </summary>
    /// <param name="event">The <see cref="OrganizationAdded"/> event.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(OrganizationAdded @event)
    {
        var repositories = await gitHub.GetOrganizationRepositories(@event.Name);
        foreach (var repository in repositories)
        {
            await commandPipeline.Execute(new AddRepository(repository.Owner, repository.Name));
        }
    }
}
