// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Issues;
using Planner.Issues.AssociatingPullRequest;
using Planner.Issues.ChangingStatus;
using Planner.Work.Completing;
using Planner.Work.Failing;
using Planner.Work.Listing;
using Planner.Work.Starting;

namespace Planner.Work.PropagatingStatus;

/// <summary>
/// Reacts to work lifecycle events by propagating the resulting status onto the covered issues:
/// started work puts them in progress, completed work associates the produced pull request and
/// marks them for review, and failed work clears their status so a human decides what happens next.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> for reading the work's read model.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
public class WorkStatusPropagation(IEventStore eventStore, ICommandPipeline commandPipeline) : IReactor
{
    /// <summary>
    /// Puts every covered issue in progress when work starts.
    /// </summary>
    /// <param name="event">The <see cref="WorkStarted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkStarted @event, EventContext context)
    {
        var work = await eventStore.ReadModels.GetInstanceById<WorkItem>(context.EventSourceId);
        foreach (var issue in work.Issues)
        {
            await commandPipeline.Execute(new ChangeIssueStatus(issue, IssueStatus.InProgress));
        }
    }

    /// <summary>
    /// Associates the produced pull request with every covered issue and marks them for review when
    /// implementation work completes.
    /// </summary>
    /// <param name="event">The <see cref="WorkCompleted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkCompleted @event, EventContext context)
    {
        var work = await eventStore.ReadModels.GetInstanceById<WorkItem>(context.EventSourceId);
        var hasPullRequest = @event.PullRequest != PullRequestNumber.NotSet;
        foreach (var issue in work.Issues)
        {
            if (hasPullRequest)
            {
                await commandPipeline.Execute(new AssociatePullRequest(
                    issue,
                    @event.PullRequest,
                    @event.PullRequestUrl,
                    @event.PullRequestOwner,
                    @event.PullRequestRepository));
            }

            await commandPipeline.Execute(new ChangeIssueStatus(issue, IssueStatus.ForReview));
        }
    }

    /// <summary>
    /// Clears the status of every covered issue when work fails.
    /// </summary>
    /// <param name="event">The <see cref="WorkFailed"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkFailed @event, EventContext context)
    {
        var work = await eventStore.ReadModels.GetInstanceById<WorkItem>(context.EventSourceId);
        foreach (var issue in work.Issues)
        {
            await commandPipeline.Execute(new ChangeIssueStatus(issue, IssueStatus.None));
        }
    }
}
