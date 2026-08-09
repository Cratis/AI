// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Orleans.Runtime;

namespace Planner.Work.Scheduling;

/// <summary>
/// The scheduler grain - runs a scheduling pass on a recurring reminder and whenever poked.
/// </summary>
/// <param name="dispatcher">The <see cref="IWorkDispatcher"/> that performs the pass.</param>
/// <param name="logger">The logger.</param>
public class WorkSchedulerGrain(IWorkDispatcher dispatcher, ILogger<WorkSchedulerGrain> logger) : Grain, IWorkScheduler, IRemindable
{
    /// <summary>
    /// The name of the recurring scheduling reminder.
    /// </summary>
    public const string ReminderName = "work-scheduling";

    /// <inheritdoc/>
    public async Task Ensure() =>
        await this.RegisterOrUpdateReminder(ReminderName, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1));

    /// <inheritdoc/>
    public Task Poke() => RunPass();

    /// <inheritdoc/>
    public Task ReceiveReminder(string reminderName, TickStatus status) => RunPass();

    async Task RunPass()
    {
        try
        {
            await dispatcher.RunSchedulingPass();
        }
        catch (Exception exception)
        {
            logger.SchedulingPassFailed(exception);
        }
    }
}
