// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Planner.Accounts.Listing;
using Planner.Work.Listing;
using Planner.Work.Scheduling;

namespace Planner.Accounts.Usage;

/// <summary>
/// Read model for the usage statistics of a Claude account - computed on demand from the account's
/// work sessions and the configured plan boundaries, mirroring what the scheduler enforces.
/// </summary>
/// <param name="Id">The account identity.</param>
/// <param name="Name">The display name of the account.</param>
/// <param name="Plan">The subscription plan of the account.</param>
/// <param name="SessionsLastFiveHours">Sessions started within the rolling five-hour window.</param>
/// <param name="SessionsPerFiveHours">The plan's session limit for the five-hour window.</param>
/// <param name="SessionsLastWeek">Sessions started within the rolling week.</param>
/// <param name="SessionsPerWeek">The plan's session limit for the week.</param>
/// <param name="FiveHourWindowResetsAt">When the oldest session in the five-hour window ages out - <see langword="null"/> when the window is empty.</param>
/// <param name="TokensUsedLastWeek">Input and output tokens the account's sessions used within the rolling week.</param>
/// <param name="TokensUsedTotal">Input and output tokens the account's sessions have used in total.</param>
/// <param name="CostLastWeek">The reported cost of the account's sessions within the rolling week, in USD.</param>
/// <param name="CostTotal">The reported cost of the account's sessions in total, in USD.</param>
[ReadModel]
public record AccountUsage(
    AccountId Id,
    AccountName Name,
    ClaudePlan Plan,
    int SessionsLastFiveHours,
    int SessionsPerFiveHours,
    int SessionsLastWeek,
    int SessionsPerWeek,
    DateTimeOffset? FiveHourWindowResetsAt,
    long TokensUsedLastWeek,
    long TokensUsedTotal,
    decimal CostLastWeek,
    decimal CostTotal)
{
    /// <summary>
    /// Gets the usage statistics for every Claude account.
    /// </summary>
    /// <param name="accounts">The MongoDB collection holding the accounts.</param>
    /// <param name="workItems">The MongoDB collection holding the work items.</param>
    /// <param name="options">The scheduling boundaries per plan.</param>
    /// <param name="timeProvider">The <see cref="TimeProvider"/> for the rolling windows.</param>
    /// <returns>The usage statistics per account.</returns>
    public static async Task<IEnumerable<AccountUsage>> AllAccountUsage(
        IMongoCollection<ClaudeAccount> accounts,
        IMongoCollection<WorkItem> workItems,
        IOptions<SchedulingOptions> options,
        TimeProvider timeProvider)
    {
        var now = timeProvider.GetUtcNow();
        var fiveHourCutoff = now - TimeSpan.FromHours(5);
        var weekCutoff = now - TimeSpan.FromDays(7);

        var accountsCursor = await accounts.FindAsync(FilterDefinition<ClaudeAccount>.Empty);
        var allAccounts = await accountsCursor.ToListAsync();

        var workCursor = await workItems.FindAsync(work => work.StartedAt != null);
        var startedWork = await workCursor.ToListAsync();

        return
        [
            .. allAccounts.Select(account =>
            {
                var sessions = startedWork.Where(work => work.Account == account.Id).ToList();
                var lastFiveHours = sessions.Where(work => work.StartedAt >= fiveHourCutoff).ToList();
                var lastWeek = sessions.Where(work => work.StartedAt >= weekCutoff).ToList();
                var limits = options.Value.LimitsFor(account.Plan);

                return new AccountUsage(
                    account.Id,
                    account.Name,
                    account.Plan,
                    lastFiveHours.Count,
                    limits.SessionsPerFiveHours,
                    lastWeek.Count,
                    limits.SessionsPerWeek,
                    lastFiveHours.Count == 0 ? null : lastFiveHours.Min(work => work.StartedAt) + TimeSpan.FromHours(5),
                    TokensOf(lastWeek),
                    TokensOf(sessions),
                    CostOf(lastWeek),
                    CostOf(sessions));
            })
        ];
    }

    static long TokensOf(IEnumerable<WorkItem> work) =>
        work.Sum(item => (item.InputTokens?.Value ?? 0L) + (item.OutputTokens?.Value ?? 0L));

    static decimal CostOf(IEnumerable<WorkItem> work) =>
        work.Sum(item => item.Cost?.Value ?? 0m);
}
