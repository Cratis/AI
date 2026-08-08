// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Work.Scheduling;

namespace Planner.Hosting;

/// <summary>
/// Activates the Planner's recurring grains at startup so their reminders are registered without
/// waiting for a first external trigger.
/// </summary>
/// <param name="grains">The <see cref="IGrainFactory"/> for reaching the grains.</param>
/// <param name="logger">The logger.</param>
public class PlannerGrainsActivator(IGrainFactory grains, ILogger<PlannerGrainsActivator> logger) : BackgroundService
{
    /// <inheritdoc/>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Give the silo and the Chronicle connection a moment to come up before first contact.
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        try
        {
            await grains.GetGrain<IWorkScheduler>(0).Ensure();
            await grains.GetGrain<GitHub.Synchronization.IGitHubSynchronizer>(0).Ensure();
            logger.GrainsActivated();
        }
        catch (Exception exception)
        {
            logger.CouldNotActivateGrains(exception);
        }
    }
}
