// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Issues.ChangingStatus;
using Planner.Work.Scheduling;

namespace Planner.Work.TriggeringScheduler;

/// <summary>
/// Reacts to events that create scheduling opportunities by poking the scheduler grain, so
/// dispatching happens immediately instead of waiting for the next reminder tick.
/// </summary>
/// <param name="grains">The <see cref="IGrainFactory"/> for reaching the scheduler grain.</param>
public class SchedulerTrigger(IGrainFactory grains) : IReactor
{
    /// <summary>
    /// Pokes the scheduler when work has been scheduled.
    /// </summary>
    /// <param name="event">The <see cref="WorkScheduled"/> event.</param>
    /// <returns>Awaitable task.</returns>
    public Task On(WorkScheduled @event) => grains.GetGrain<IWorkScheduler>(0).Poke();

    /// <summary>
    /// Pokes the scheduler when an issue becomes ready for development.
    /// </summary>
    /// <param name="event">The <see cref="IssueMarkedReadyForDevelopment"/> event.</param>
    /// <returns>Awaitable task.</returns>
    public Task On(IssueMarkedReadyForDevelopment @event) => grains.GetGrain<IWorkScheduler>(0).Poke();
}
