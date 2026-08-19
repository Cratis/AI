// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Builds.RecordingStatus;
using Planner.GitHub;
using Planner.Repositories.Listing;

namespace Planner.Builds.CheckingStatus;

/// <summary>
/// Defines the checker that records the current build status of every tracked repository - part of
/// the daily consolidation, alongside the issue synchronizer.
/// </summary>
public interface IBuildStatusChecker
{
    /// <summary>
    /// Checks the workflows of every tracked repository and records their most recent conclusion.
    /// </summary>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task CheckAll(CancellationToken cancellationToken = default);
}

/// <summary>
/// The default <see cref="IBuildStatusChecker"/> - asks GitHub for the most recent run of every
/// workflow in each tracked repository and records what it finds.
/// </summary>
/// <param name="repositories">The repository read models.</param>
/// <param name="gitHub">The <see cref="IGitHubClient"/> for talking to GitHub.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="logger">The logger.</param>
public class BuildStatusChecker(
    IMongoCollection<Repository> repositories,
    IGitHubClient gitHub,
    ICommandPipeline commandPipeline,
    ILogger<BuildStatusChecker> logger) : IBuildStatusChecker
{
    /// <inheritdoc/>
    public async Task CheckAll(CancellationToken cancellationToken = default)
    {
        var cursor = await repositories.FindAsync(FilterDefinition<Repository>.Empty, cancellationToken: cancellationToken);
        var all = await cursor.ToListAsync(cancellationToken);
        foreach (var repository in all)
        {
            await CheckRepository(repository.Owner, repository.Name, cancellationToken);
        }
    }

    async Task CheckRepository(OrganizationName owner, RepositoryName name, CancellationToken cancellationToken)
    {
        IEnumerable<GitHubWorkflowRun> runs;
        try
        {
            runs = await gitHub.GetLatestWorkflowRuns(owner, name, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.CouldNotCheckBuildStatus(exception, owner, name);
            return;
        }

        foreach (var run in runs)
        {
            await commandPipeline.Execute(new RecordBuildStatus(owner, name, run.Workflow, run.Conclusion, run.RunUrl, run.RanAt));
        }
    }
}
