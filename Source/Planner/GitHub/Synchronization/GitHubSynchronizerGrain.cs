// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Orleans.Runtime;

namespace Planner.GitHub.Synchronization;

/// <summary>
/// The consolidation grain - synchronizes all tracked repositories on a daily reminder and on demand.
/// </summary>
/// <param name="synchronizer">The <see cref="IIssueSynchronizer"/> doing the work.</param>
/// <param name="logger">The logger.</param>
public class GitHubSynchronizerGrain(IIssueSynchronizer synchronizer, ILogger<GitHubSynchronizerGrain> logger) : Grain, IGitHubSynchronizer, IRemindable
{
    /// <summary>
    /// The name of the recurring consolidation reminder.
    /// </summary>
    public const string ReminderName = "github-consolidation";

    /// <inheritdoc/>
    public async Task Ensure() =>
        await this.RegisterOrUpdateReminder(ReminderName, TimeSpan.FromMinutes(1), TimeSpan.FromDays(1));

    /// <inheritdoc/>
    public Task SynchronizeNow() => Run();

    /// <inheritdoc/>
    public Task ReceiveReminder(string reminderName, TickStatus status) => Run();

    async Task Run()
    {
        try
        {
            await synchronizer.SynchronizeAll();
        }
        catch (Exception exception)
        {
            logger.ConsolidationFailed(exception);
        }
    }
}
