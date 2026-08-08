// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Issues.Closing;
using Planner.Issues.Registration;
using Planner.Issues.Renaming;
using Planner.Issues.Reopening;
using Planner.Repositories.Listing;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.GitHub.Synchronization;

/// <summary>
/// Defines the synchronizer that consolidates the Planner's mirrored issues with GitHub - used for
/// the initial load of a repository and the daily consolidation that catches anything a missed
/// webhook would otherwise skip.
/// </summary>
public interface IIssueSynchronizer
{
    /// <summary>
    /// Synchronizes the issues of every tracked repository.
    /// </summary>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task SynchronizeAll(CancellationToken cancellationToken = default);

    /// <summary>
    /// Synchronizes the issues of a single repository.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="name">The repository name.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    Task SynchronizeRepository(OrganizationName owner, RepositoryName name, CancellationToken cancellationToken = default);
}

/// <summary>
/// The default <see cref="IIssueSynchronizer"/> - compares what GitHub holds against the mirrored
/// read models and executes the commands for anything new or changed.
/// </summary>
/// <param name="repositories">The repository read models.</param>
/// <param name="issues">The issue read models.</param>
/// <param name="gitHub">The <see cref="IGitHubClient"/> for talking to GitHub.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="logger">The logger.</param>
public class IssueSynchronizer(
    IMongoCollection<Repository> repositories,
    IMongoCollection<ListedIssue> issues,
    IGitHubClient gitHub,
    ICommandPipeline commandPipeline,
    ILogger<IssueSynchronizer> logger) : IIssueSynchronizer
{
    /// <inheritdoc/>
    public async Task SynchronizeAll(CancellationToken cancellationToken = default)
    {
        var cursor = await repositories.FindAsync(FilterDefinition<Repository>.Empty, cancellationToken: cancellationToken);
        var all = await cursor.ToListAsync(cancellationToken);
        foreach (var repository in all)
        {
            await SynchronizeRepository(repository.Owner, repository.Name, cancellationToken);
        }
    }

    /// <inheritdoc/>
    public async Task SynchronizeRepository(OrganizationName owner, RepositoryName name, CancellationToken cancellationToken = default)
    {
        logger.SynchronizingRepository(owner, name);
        var gitHubIssues = await gitHub.GetIssues(owner, name, cancellationToken);

        var cursor = await issues.FindAsync(issue => issue.Owner == owner && issue.Repository == name, cancellationToken: cancellationToken);
        var known = (await cursor.ToListAsync(cancellationToken)).ToDictionary(issue => issue.Number);

        foreach (var gitHubIssue in gitHubIssues)
        {
            if (!known.TryGetValue(gitHubIssue.Number, out var mirrored))
            {
                await commandPipeline.Execute(new RegisterIssue(
                    owner,
                    name,
                    gitHubIssue.Number,
                    gitHubIssue.Title,
                    gitHubIssue.Type,
                    gitHubIssue.CreatedBy,
                    gitHubIssue.CreatedAt,
                    gitHubIssue.AuthorAssociation,
                    gitHubIssue.IsOpen));
                continue;
            }

            var issueId = IssueId.From(owner, name, gitHubIssue.Number);
            if (mirrored.Title != gitHubIssue.Title)
            {
                await commandPipeline.Execute(new RenameIssue(issueId, gitHubIssue.Title));
            }

            if (mirrored.IsOpen && !gitHubIssue.IsOpen)
            {
                await commandPipeline.Execute(new CloseIssue(issueId));
            }
            else if (!mirrored.IsOpen && gitHubIssue.IsOpen)
            {
                await commandPipeline.Execute(new ReopenIssue(issueId));
            }
        }
    }
}
