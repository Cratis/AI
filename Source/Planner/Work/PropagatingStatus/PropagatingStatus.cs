// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Planner.Issues;
using Planner.Issues.AssociatingPullRequest;
using Planner.Issues.ChangingStatus;
using Planner.Work.Completing;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Failing;
using Planner.Work.Listing;
using Planner.Work.Starting;
using Planner.Work.Stopping;

namespace Planner.Work.PropagatingStatus;

/// <summary>
/// Reacts to work lifecycle events by propagating the resulting status onto the covered issues:
/// started work puts them in progress, completed work associates the produced pull request and
/// marks them for review, and failed, stopped or investigated work clears their status so a human
/// decides what happens next.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> for reading the work's read model.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="systemExecution">The <see cref="ISystemExecution"/> the commands below run as - a reactor has no HTTP request behind it.</param>
public class WorkStatusPropagation(IEventStore eventStore, ICommandPipeline commandPipeline, ISystemExecution systemExecution) : IReactor
{
    /// <summary>
    /// Puts every covered issue in progress when work starts.
    /// </summary>
    /// <param name="event">The <see cref="WorkStarted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkStarted @event, EventContext context)
    {
        using var scope = systemExecution.AsSystem();
        foreach (var issue in await CoveredIssues(context))
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
        using var scope = systemExecution.AsSystem();
        var hasPullRequest = @event.PullRequest != PullRequestNumber.NotSet;
        foreach (var issue in await CoveredIssues(context))
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
        using var scope = systemExecution.AsSystem();
        foreach (var issue in await CoveredIssues(context))
        {
            await commandPipeline.Execute(new ChangeIssueStatus(issue, IssueStatus.None));
        }
    }

    /// <summary>
    /// Clears the status of every covered issue when work is stopped deliberately.
    /// </summary>
    /// <param name="event">The <see cref="WorkStopped"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkStopped @event, EventContext context)
    {
        using var scope = systemExecution.AsSystem();
        foreach (var issue in await CoveredIssues(context))
        {
            await commandPipeline.Execute(new ChangeIssueStatus(issue, IssueStatus.None));
        }
    }

    /// <summary>
    /// Hands every covered issue back to a human when an investigation completes. An investigation
    /// produces a plan and a suggested model - both recorded on the issue and posted to GitHub -
    /// but no code and no pull request, so the issue is not in progress and not for review. Clearing
    /// the status returns it to the backlog with its findings attached, where a person decides
    /// whether to mark it ready for development; promoting it automatically would send an agent
    /// straight at code an outside reporter asked for, with nobody having read the plan.
    /// </summary>
    /// <param name="event">The <see cref="InvestigationCompleted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(InvestigationCompleted @event, EventContext context)
    {
        using var scope = systemExecution.AsSystem();
        foreach (var issue in await CoveredIssues(context))
        {
            await commandPipeline.Execute(new ChangeIssueStatus(issue, IssueStatus.None));
        }
    }

    /// <summary>
    /// The issues a unit of work covers, or nothing at all when it covers none. Ad-hoc work and
    /// alert investigations are not about issues, and <see cref="WorkItem.Issues"/> is not populated
    /// for them - an alert investigation is scheduled by an event that carries no issues at all. The
    /// work item can also be absent entirely when the read model has not caught up. None of those is
    /// a reason to throw: a throw here pauses the partition and can quarantine the observer, which
    /// does not resume on its own.
    /// </summary>
    /// <param name="context">The <see cref="EventContext"/> of the work lifecycle event.</param>
    /// <returns>The identities of the covered issues.</returns>
    async Task<IEnumerable<IssueId>> CoveredIssues(EventContext context)
    {
        var work = await eventStore.ReadModels.GetInstanceById<WorkItem>(context.EventSourceId);
        return work?.Purpose is WorkPurpose.Investigation or WorkPurpose.Implementation
            ? work.Issues ?? []
            : [];
    }
}
