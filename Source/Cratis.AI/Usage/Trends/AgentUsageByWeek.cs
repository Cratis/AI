// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using MongoDB.Driver;

namespace Cratis.AI.Usage.Trends;

/// <summary>
/// Total CPU and memory usage every agent session recorded, accumulated per calendar week - a
/// dashboard's "resource usage over time" chart. A real accumulating projection: every
/// <see cref="AgentSessionUsageRecorded"/> event, regardless of which session's stream it was
/// appended to, is keyed by its own <see cref="AgentSessionUsageRecorded.WeekKey"/> rather than by
/// event source, so one document per week accumulates the total across every session. Generalized
/// from Direct's <c>Dashboard.Trends.AgentUsageByWeek</c> (plan Section 5.3d).
/// </summary>
/// <param name="Week">The calendar week the usage was accumulated for.</param>
/// <param name="CpuSeconds">The total CPU time accumulated across every session that week.</param>
/// <param name="MemoryBytes">The total peak memory accumulated across every session that week.</param>
[ReadModel]
[FromEvent<AgentSessionUsageRecorded>(key: nameof(AgentSessionUsageRecorded.WeekKey))]
public record AgentUsageByWeek(
    [Key][SetFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.WeekKey))] WeekKey Week,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.CpuSeconds))] CpuSeconds CpuSeconds,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.MemoryBytes))] MemoryBytes MemoryBytes)
{
    /// <summary>
    /// How many of the most recent weeks a dashboard chart typically shows.
    /// </summary>
    public const int RecentWeekCount = 26;

    /// <summary>
    /// Gets the most recent weeks that recorded any agent session usage, oldest first.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the weekly totals.</param>
    /// <returns>Up to <see cref="RecentWeekCount"/> weeks, oldest first.</returns>
    public static async Task<IEnumerable<AgentUsageByWeek>> RecentWeeks(IMongoCollection<AgentUsageByWeek> collection)
    {
        var all = await (await collection.FindAsync(FilterDefinition<AgentUsageByWeek>.Empty)).ToListAsync();
        return all.OrderBy(week => week.Week.Value).TakeLast(RecentWeekCount);
    }
}
