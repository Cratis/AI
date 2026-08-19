// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Microsoft.Extensions.Options;
using Planner.Issues.Registration;
using Planner.Work.Scheduling;

namespace Planner.Work.AutoInvestigating;

/// <summary>
/// Reacts to an issue registered by someone outside the organization by scheduling an
/// investigation for it - an agent produces an implementation plan and asks for more input on the
/// GitHub issue when it is unsure.
/// </summary>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="options">The scheduling options - carries the investigation model.</param>
/// <param name="systemExecution">The <see cref="ISystemExecution"/> the commands below run as - there is no HTTP request behind this.</param>
public class AutoInvestigation(ICommandPipeline commandPipeline, IOptions<SchedulingOptions> options, ISystemExecution systemExecution) : IReactor
{
    /// <summary>
    /// Schedules an investigation when the registered issue came from an external reporter.
    /// </summary>
    /// <param name="event">The <see cref="IssueRegistered"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(IssueRegistered @event, EventContext context)
    {
        if (@event.AuthorAssociation != AuthorAssociation.External || !@event.IsOpen)
        {
            return;
        }

        // A reactor has no HTTP request behind it - scheduling the investigation runs as the system.
        using var scope = systemExecution.AsSystem();

        await commandPipeline.Execute(new ScheduleWork(
            WorkPurpose.Investigation,
            [new IssueId(context.EventSourceId.Value)],
            options.Value.InvestigationModel));
    }
}
