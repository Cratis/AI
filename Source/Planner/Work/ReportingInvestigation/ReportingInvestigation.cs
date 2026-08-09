// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.GitHub;
using Planner.Issues.RecordingInvestigation;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Listing;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.ReportingInvestigation;

/// <summary>
/// Reacts to a completed investigation by recording the findings on every covered issue and
/// commenting them back on the original GitHub issue so team and reporter can see them.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> for reading the covered issues' read models by key.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="gitHub">The <see cref="IGitHubClient"/> for commenting on the GitHub issues.</param>
public class InvestigationReporting(IEventStore eventStore, ICommandPipeline commandPipeline, IGitHubClient gitHub) : IReactor
{
    /// <summary>
    /// Records the findings on the covered issues and comments on the original GitHub issues.
    /// Commenting is an external, non-idempotent side effect - hence once only.
    /// </summary>
    /// <param name="event">The <see cref="InvestigationCompleted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(InvestigationCompleted @event, EventContext context)
    {
        var work = await eventStore.ReadModels.GetInstanceById<WorkItem>(context.EventSourceId);
        foreach (var issueId in work.Issues)
        {
            await commandPipeline.Execute(new RecordInvestigation(issueId, @event.Findings, @event.SuggestedModel));

            var issue = await eventStore.ReadModels.GetInstanceById<ListedIssue>((EventSourceId)issueId);
            if (issue is not null)
            {
                await gitHub.AddIssueComment(
                    issue.Owner,
                    issue.Repository,
                    issue.Number,
                    $"## Investigation\n\n{@event.Findings.Value}\n\n_Suggested model for implementation: `{@event.SuggestedModel.Value}`_");
            }
        }
    }
}
