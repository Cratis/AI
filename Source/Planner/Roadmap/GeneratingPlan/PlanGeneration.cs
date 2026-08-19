// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.GitHub;
using Planner.LanguageModels;
using Planner.Roadmap.RequestingPlan;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Roadmap.GeneratingPlan;

/// <summary>
/// Reacts to a requested plan by asking the language model to produce one covering the selected
/// issues together, and posting it back as a comment on each covered GitHub issue so it is visible
/// where the team works.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> for reading the covered issues' read models.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="languageModel">The <see cref="ILanguageModel"/> the plan is generated with.</param>
/// <param name="gitHub">The <see cref="IGitHubClient"/> for posting the plan back to GitHub.</param>
public class PlanGeneration(IEventStore eventStore, ICommandPipeline commandPipeline, ILanguageModel languageModel, IGitHubClient gitHub) : IReactor
{
    /// <summary>
    /// Generates the plan for a newly requested set of issues.
    /// </summary>
    /// <param name="event">The <see cref="PlanRequested"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(PlanRequested @event, EventContext context)
    {
        var planId = new PlanId(Guid.Parse(context.EventSourceId.Value));

        var issues = new List<ListedIssue>();
        foreach (var issueId in @event.Issues)
        {
            var issue = await eventStore.ReadModels.GetInstanceById<ListedIssue>((EventSourceId)issueId);
            if (issue is not null)
            {
                issues.Add(issue);
            }
        }

        if (issues.Count == 0)
        {
            await commandPipeline.Execute(new FailPlanGeneration(planId, "None of the selected issues could be found"));
            return;
        }

        var result = await languageModel.Complete(PlanPrompts.Build(issues, @event.Instructions.Value));
        if (!result.Succeeded)
        {
            await commandPipeline.Execute(new FailPlanGeneration(planId, result.FailureReason));
            return;
        }

        await commandPipeline.Execute(new GeneratePlan(planId, result.Text));

        foreach (var issue in issues)
        {
            await gitHub.AddIssueComment(
                issue.Owner,
                issue.Repository,
                issue.Number,
                $"## Plan\n\nThis issue is part of a plan covering {issues.Count} issue(s) together.\n\n{result.Text}{AIIdentity.Footer()}");
        }
    }
}
