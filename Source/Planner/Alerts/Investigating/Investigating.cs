// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;
using Planner.Alerts.Raising;
using Planner.Alerts.RecordingInvestigation;
using Planner.Work;
using Planner.Work.Completing;
using Planner.Work.Failing;
using Planner.Work.Listing;
using Planner.Work.SchedulingAlertInvestigation;
using Planner.Work.Starting;
using Planner.Work.Stopping;

namespace Planner.Alerts.Investigating;

/// <summary>
/// Puts an agent on an alert the moment it is raised. Only a genuinely new alert is investigated -
/// a condition being re-reported while an agent is already looking at it appends
/// <see cref="AlertObserved"/> rather than <see cref="AlertRaised"/>, so a watchdog reporting the
/// same problem every five minutes never queues a second investigation.
/// </summary>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="options">The alert configuration.</param>
public class AlertInvestigation(ICommandPipeline commandPipeline, IOptions<AlertOptions> options) : IReactor
{
    /// <summary>
    /// Schedules an investigation for a newly raised alert.
    /// </summary>
    /// <param name="event">The <see cref="AlertRaised"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(AlertRaised @event, EventContext context)
    {
        if (!options.Value.AutoInvestigate)
        {
            return;
        }

        await commandPipeline.Execute(new ScheduleAlertInvestigation(new AlertId(context.EventSourceId.Value)));
    }
}

/// <summary>
/// Carries the fate of an alert investigation back to the alert it was about. The work item is the
/// only place that knows an alert was involved, so every work lifecycle event is inspected and the
/// ones belonging to other purposes are ignored.
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> for reading the work's read model.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
public class AlertInvestigationPropagation(IEventStore eventStore, ICommandPipeline commandPipeline) : IReactor
{
    /// <summary>
    /// Records that an agent has picked the alert up.
    /// </summary>
    /// <param name="event">The <see cref="WorkStarted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkStarted @event, EventContext context)
    {
        if (await AlertFor(context) is { } alert)
        {
            await commandPipeline.Execute(new StartAlertInvestigation(alert, new WorkId(Guid.Parse(context.EventSourceId.Value))));
        }
    }

    /// <summary>
    /// Records what the agent concluded.
    /// </summary>
    /// <param name="event">The <see cref="WorkCompleted"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkCompleted @event, EventContext context)
    {
        if (await AlertFor(context) is { } alert)
        {
            await commandPipeline.Execute(new ConcludeAlertInvestigation(
                alert,
                AlertOutcomes.Read(@event.Summary.Value),
                @event.Summary.Value));
        }
    }

    /// <summary>
    /// Records that the investigation never produced a conclusion.
    /// </summary>
    /// <param name="event">The <see cref="WorkFailed"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkFailed @event, EventContext context)
    {
        if (await AlertFor(context) is { } alert)
        {
            await commandPipeline.Execute(new FailAlertInvestigation(alert, @event.Reason.Value));
        }
    }

    /// <summary>
    /// Records that someone stopped the investigation, which leaves the alert as unexamined as it
    /// was before - so it goes back to waiting for a person rather than looking dealt with.
    /// </summary>
    /// <param name="event">The <see cref="WorkStopped"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    public async Task On(WorkStopped @event, EventContext context)
    {
        if (await AlertFor(context) is { } alert)
        {
            await commandPipeline.Execute(new FailAlertInvestigation(alert, "The investigation was stopped before it concluded"));
        }
    }

    async Task<AlertId?> AlertFor(EventContext context)
    {
        var work = await eventStore.ReadModels.GetInstanceById<WorkItem>(context.EventSourceId);
        return work?.Purpose == WorkPurpose.AlertInvestigation ? work.Alert : null;
    }
}
