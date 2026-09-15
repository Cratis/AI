// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using MongoDB.Driver;

namespace Cratis.AI.Usage.Trends;

/// <summary>
/// Total CPU and memory usage every agent session recorded, accumulated per calendar month - the
/// monthly counterpart to <see cref="AgentUsageByWeek"/>. Generalized from Direct's
/// <c>Dashboard.Trends.AgentUsageByMonth</c> (plan Section 5.3d).
/// </summary>
/// <param name="Month">The calendar month the usage was accumulated for.</param>
/// <param name="CpuSeconds">The total CPU time accumulated across every session that month.</param>
/// <param name="MemoryBytes">The total peak memory accumulated across every session that month.</param>
[ReadModel]
[FromEvent<AgentSessionUsageRecorded>(key: nameof(AgentSessionUsageRecorded.MonthKey))]
public record AgentUsageByMonth(
    [Key][SetFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.MonthKey))] MonthKey Month,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.CpuSeconds))] CpuSeconds CpuSeconds,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.MemoryBytes))] MemoryBytes MemoryBytes)
{
    /// <summary>
    /// How many of the most recent months a dashboard chart typically shows.
    /// </summary>
    public const int RecentMonthCount = 12;

    /// <summary>
    /// Gets the most recent months that recorded any agent session usage, oldest first.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the monthly totals.</param>
    /// <returns>Up to <see cref="RecentMonthCount"/> months, oldest first.</returns>
    public static async Task<IEnumerable<AgentUsageByMonth>> RecentMonths(IMongoCollection<AgentUsageByMonth> collection)
    {
        var all = await (await collection.FindAsync(FilterDefinition<AgentUsageByMonth>.Empty)).ToListAsync();
        return all.OrderBy(month => month.Month.Value).TakeLast(RecentMonthCount);
    }
}
