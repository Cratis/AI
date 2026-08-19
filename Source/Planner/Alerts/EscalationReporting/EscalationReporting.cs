// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;
using Planner.Alerts.AutoConvertingToIssue;
using Planner.Alerts.Listing;
using Planner.Alerts.RecordingInvestigation;
using Planner.GitHub;
using Planner.Operations;

namespace Planner.Alerts.EscalationReporting;

/// <summary>
/// Reacts to an alert an agent could not resolve by filing it as a GitHub issue automatically, so
/// every "a human must look at this" outcome leaves a trail instead of sitting silently on the
/// board. Only runs when the deployment configured an operational repository to file into
/// (<see cref="OperationsOptions.IssueOwner"/>/<see cref="OperationsOptions.IssueRepository"/>) -
/// otherwise the alert still waits on the board for a person, exactly as before. An alert that
/// recurs after already being filed gets a comment on the existing issue instead of a duplicate.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> for reading the alert's read model.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="gitHub">The <see cref="IGitHubClient"/> for commenting on an already-filed issue.</param>
/// <param name="options">The operations configuration - carries the default issue repository.</param>
public class AlertEscalationReporting(
    IEventStore eventStore,
    ICommandPipeline commandPipeline,
    IGitHubClient gitHub,
    IOptions<OperationsOptions> options) : IReactor
{
    /// <summary>
    /// Files the alert as an issue, or comments on the one already filed for it.
    /// </summary>
    /// <param name="event">The <see cref="AlertEscalated"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(AlertEscalated @event, EventContext context)
    {
        var operations = options.Value;
        if (string.IsNullOrWhiteSpace(operations.IssueOwner) || string.IsNullOrWhiteSpace(operations.IssueRepository))
        {
            return;
        }

        var alertId = new AlertId(context.EventSourceId.Value);
        var alert = await eventStore.ReadModels.GetInstanceById<Alert>(context.EventSourceId);
        if (alert is null)
        {
            return;
        }

        if (alert.Issue is { } existing && existing != IssueNumber.NotSet)
        {
            await gitHub.AddIssueComment(
                alert.IssueOwner ?? operations.IssueOwner,
                alert.IssueRepository ?? operations.IssueRepository,
                existing,
                $"This alert recurred and still needs attention:\n\n{@event.Findings.Value}{AIIdentity.Footer()}");
            return;
        }

        await commandPipeline.Execute(new AutoConvertAlertToIssue(
            alertId,
            operations.IssueOwner,
            operations.IssueRepository,
            $"Alert: {alert.Title.Value}",
            $"{alert.Summary.Value}\n\n## What the agent found\n\n{@event.Findings.Value}"));
    }
}
