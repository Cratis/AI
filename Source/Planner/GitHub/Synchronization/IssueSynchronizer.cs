// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using MongoDB.Driver;
using Planner.Issues.ChangingAssignees;
using Planner.Issues.ChangingBody;
using Planner.Issues.ChangingLabels;
using Planner.Issues.Closing;
using Planner.Issues.Comments.Recording;
using Planner.Issues.Comments.Removing;
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
/// <param name="systemExecution">The <see cref="ISystemExecution"/> the commands below run as - this is a scheduled/reactor-triggered sweep with no HTTP request behind it.</param>
/// <param name="logger">The logger.</param>
public class IssueSynchronizer(
    IMongoCollection<Repository> repositories,
    IMongoCollection<ListedIssue> issues,
    IGitHubClient gitHub,
    ICommandPipeline commandPipeline,
    ISystemExecution systemExecution,
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

        // One scope for the whole repository sync - every command it and its helpers below issue
        // (new issues, renames, status, comments) belongs to this one reconciliation pass.
        using var scope = systemExecution.AsSystem();
        var gitHubIssues = await gitHub.GetIssues(owner, name, cancellationToken);

        var cursor = await issues.FindAsync(issue => issue.Owner == owner && issue.Repository == name, cancellationToken: cancellationToken);
        var known = (await cursor.ToListAsync(cancellationToken)).ToDictionary(issue => issue.Number);

        foreach (var gitHubIssue in gitHubIssues)
        {
            if (!known.TryGetValue(gitHubIssue.Number, out var mirrored))
            {
                // Closed issues that were never mirrored stay out of the Planner.
                if (!gitHubIssue.IsOpen)
                {
                    continue;
                }

                await commandPipeline.Execute(new RegisterIssue(
                    owner,
                    name,
                    gitHubIssue.Number,
                    gitHubIssue.Title,
                    gitHubIssue.Type,
                    gitHubIssue.CreatedBy,
                    gitHubIssue.CreatedAt,
                    gitHubIssue.AuthorAssociation,
                    gitHubIssue.IsOpen,
                    gitHubIssue.Body,
                    gitHubIssue.Labels));

                // IssueRegistered carries no assignees - a stored event never gains a new property.
                // An issue registered already assigned arrives complete by following up with the fact.
                if (gitHubIssue.Assignees.Any())
                {
                    var newIssueId = IssueId.From(owner, name, gitHubIssue.Number);
                    await commandPipeline.Execute(new ChangeIssueAssignees(newIssueId, gitHubIssue.Assignees));
                }

                await SynchronizeComments(owner, name, gitHubIssue, [], cancellationToken);
                continue;
            }

            await SynchronizeKnownIssue(owner, name, gitHubIssue, mirrored, cancellationToken);
        }
    }

    async Task SynchronizeKnownIssue(
        OrganizationName owner,
        RepositoryName name,
        GitHubIssue gitHubIssue,
        ListedIssue mirrored,
        CancellationToken cancellationToken)
    {
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

        var mirroredBody = mirrored.Body ?? IssueBody.NotSet;
        if (!mirroredBody.Equals(gitHubIssue.Body))
        {
            await commandPipeline.Execute(new ChangeIssueBody(issueId, gitHubIssue.Body));
        }

        var mirroredLabels = (mirrored.Labels ?? []).ToHashSet();
        if (!mirroredLabels.SetEquals(gitHubIssue.Labels))
        {
            await commandPipeline.Execute(new ChangeIssueLabels(issueId, gitHubIssue.Labels));
        }

        // Also heals issues that were mirrored before assignees were ingested - their Assignees
        // start out unset, so the first sync after upgrading reconciles them from GitHub.
        var mirroredAssignees = (mirrored.Assignees ?? []).ToHashSet();
        if (!mirroredAssignees.SetEquals(gitHubIssue.Assignees))
        {
            await commandPipeline.Execute(new ChangeIssueAssignees(issueId, gitHubIssue.Assignees));
        }

        var mirroredComments = (mirrored.Comments ?? []).ToList();
        if (gitHubIssue.CommentCount != mirroredComments.Count)
        {
            await SynchronizeComments(owner, name, gitHubIssue, mirroredComments, cancellationToken);
        }
    }

    async Task SynchronizeComments(
        OrganizationName owner,
        RepositoryName name,
        GitHubIssue gitHubIssue,
        List<Planner.Issues.Listing.IssueComment> mirroredComments,
        CancellationToken cancellationToken)
    {
        if (gitHubIssue.CommentCount == 0 && mirroredComments.Count == 0)
        {
            return;
        }

        var issueId = IssueId.From(owner, name, gitHubIssue.Number);
        var gitHubComments = (await gitHub.GetIssueComments(owner, name, gitHubIssue.Number, cancellationToken)).ToList();
        var knownComments = mirroredComments.ToDictionary(comment => comment.Id);

        foreach (var comment in gitHubComments.Where(comment => !knownComments.ContainsKey(comment.Id)))
        {
            await commandPipeline.Execute(new RecordIssueComment(issueId, comment.Id, comment.Author, comment.Body, comment.CommentedAt));
        }

        var currentIds = gitHubComments.Select(comment => comment.Id).ToHashSet();
        foreach (var removed in mirroredComments.Where(comment => !currentIds.Contains(comment.Id)))
        {
            await commandPipeline.Execute(new RemoveIssueComment(issueId, removed.Id));
        }
    }
}
