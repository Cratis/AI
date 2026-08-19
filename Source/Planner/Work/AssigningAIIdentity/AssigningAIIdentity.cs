// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;
using Planner.GitHub;
using Planner.GitHub.App;
using Planner.Work.Completing;
using Planner.Work.Failing;
using Planner.Work.Listing;
using Planner.Work.Starting;
using Planner.Work.Stopping;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.AssigningAIIdentity;

/// <summary>
/// Reacts to work lifecycle events by assigning the covered issues to the Planner's AI identity on
/// GitHub while an agent works on them, and unassigning once it hands them back - so anyone looking
/// at GitHub can tell what the Planner has taken on. GitHub does not allow assigning issues to an
/// App itself, only to a user account, so this only does anything once
/// <see cref="GitHubAppOptions.AIUserLogin"/> is configured with a machine user's login; it is a
/// silent no-op otherwise.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> for reading the work's read model.</param>
/// <param name="gitHub">The <see cref="IGitHubClient"/> for assigning/unassigning on GitHub.</param>
/// <param name="options">The GitHub App configuration - carries the AI identity's login.</param>
public class AIIdentityAssignment(IEventStore eventStore, IGitHubClient gitHub, IOptions<GitHubAppOptions> options) : IReactor
{
    /// <summary>
    /// Assigns every issue covered by a unit of work to the AI identity once it starts running.
    /// </summary>
    /// <param name="event">The <see cref="WorkStarted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public Task On(WorkStarted @event, EventContext context) => ForCoveredIssues(context, Assign);

    /// <summary>
    /// Unassigns the AI identity from every issue covered by a unit of work once it completes.
    /// </summary>
    /// <param name="event">The <see cref="WorkCompleted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public Task On(WorkCompleted @event, EventContext context) => ForCoveredIssues(context, Unassign);

    /// <summary>
    /// Unassigns the AI identity from every issue covered by a unit of work once it fails.
    /// </summary>
    /// <param name="event">The <see cref="WorkFailed"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public Task On(WorkFailed @event, EventContext context) => ForCoveredIssues(context, Unassign);

    /// <summary>
    /// Unassigns the AI identity from every issue covered by a unit of work once it is stopped.
    /// </summary>
    /// <param name="event">The <see cref="WorkStopped"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public Task On(WorkStopped @event, EventContext context) => ForCoveredIssues(context, Unassign);

    async Task ForCoveredIssues(EventContext context, Func<ListedIssue, CancellationToken, Task> action)
    {
        if (string.IsNullOrWhiteSpace(options.Value.AIUserLogin))
        {
            return;
        }

        var work = await eventStore.ReadModels.GetInstanceById<WorkItem>(context.EventSourceId);
        foreach (var issueId in work.Issues)
        {
            var issue = await eventStore.ReadModels.GetInstanceById<ListedIssue>((EventSourceId)issueId);
            if (issue is not null)
            {
                await action(issue, CancellationToken.None);
            }
        }
    }

    Task Assign(ListedIssue issue, CancellationToken cancellationToken) =>
        gitHub.AssignIssue(issue.Owner, issue.Repository, issue.Number, options.Value.AIUserLogin, cancellationToken);

    Task Unassign(ListedIssue issue, CancellationToken cancellationToken) =>
        gitHub.UnassignIssue(issue.Owner, issue.Repository, issue.Number, options.Value.AIUserLogin, cancellationToken);
}
