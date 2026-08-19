// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Planner.GitHub;
using Planner.Issues.Classifying;
using Planner.Issues.Registration;
using Planner.LanguageModels;

namespace Planner.Issues.Triaging;

/// <summary>
/// Reacts to every newly registered issue by acknowledging it on GitHub and classifying it with the
/// Planner's own language model, regardless of who filed it - the pipeline that gives "avoid missing
/// issues registered by externals" its teeth. Acknowledging always happens; classification degrades
/// silently to "not classified" when no language model is configured (<see cref="LanguageModelOptions.IsConfigured"/>),
/// so a deployment without one behaves exactly as before.
/// </summary>
/// <param name="gitHub">The <see cref="IGitHubClient"/> for commenting and applying labels.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="languageModel">The <see cref="ILanguageModel"/> the classification is asked from.</param>
/// <param name="systemExecution">The <see cref="ISystemExecution"/> the commands below run as - there is no HTTP request behind this.</param>
public class IssueTriage(IGitHubClient gitHub, ICommandPipeline commandPipeline, ILanguageModel languageModel, ISystemExecution systemExecution) : IReactor
{
    /// <summary>
    /// Acknowledges and classifies a newly registered issue. Runs once per issue - an external,
    /// non-idempotent side effect (the GitHub comment) makes replay unsafe otherwise.
    /// </summary>
    /// <param name="event">The <see cref="IssueRegistered"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(IssueRegistered @event, EventContext context)
    {
        if (!@event.IsOpen)
        {
            // The consolidation registers already-closed issues too, for a complete history - no
            // point acknowledging or classifying something that is already done.
            return;
        }

        await gitHub.AddIssueComment(
            @event.Owner,
            @event.Repository,
            @event.Number,
            $"Thanks for opening this - it has been received and will be looked at.{AIIdentity.Footer()}");

        var result = await languageModel.Complete(TriagePrompts.Classify(@event));
        if (!result.Succeeded)
        {
            return;
        }

        var classification = TriageClassification.Parse(result.Text);
        if (classification is null)
        {
            return;
        }

        var issueId = new IssueId(context.EventSourceId.Value);

        // A reactor has no HTTP request behind it - the triage classification runs as the system.
        using var scope = systemExecution.AsSystem();

        await commandPipeline.Execute(new ClassifyIssue(
            issueId,
            classification.Kind,
            classification.Feasibility,
            classification.Priority,
            classification.Labels,
            classification.Area,
            classification.Model));

        if (classification.Labels.Any())
        {
            await gitHub.AddLabels(@event.Owner, @event.Repository, @event.Number, classification.Labels);
        }
    }
}
