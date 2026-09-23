// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using MongoDB.Driver;

namespace Cratis.AI.Usage.Daily;

/// <summary>
/// One day's agent usage along one dimension - which provider served it, which agent ran it, on
/// which model, for what purpose. A consumer's own usage page aggregates these rows client-side, so
/// its filters can narrow the same trailing window without a second round trip per filter.
/// Generalized from Direct's <c>AIUsage.DailyUsage.AgentUsageByDay</c> (plan Section 5.3d) - unlike
/// Direct's original, which read from its own <c>IRecordedWork</c>/<c>ILanguageModelJobs</c> and so
/// bucketed work and completions separately, this reads a single source, the package's own
/// <see cref="AgentSessionUsageRecorded"/>, since that event already carries every dimension both of
/// Direct's sources had to be combined to get.
/// </summary>
/// <remarks>
/// A real accumulating projection, keyed on the event's precomputed
/// <see cref="AgentSessionUsageRecorded.DailyBucketKey"/> - the same treatment
/// <see cref="Trends.AgentUsageByWeek"/> and <see cref="Trends.AgentUsageByMonth"/> already get, and
/// what the daily model should always have had. It was previously <c>[Passive]</c>, recomputing a
/// year of buckets with an in-memory <c>GroupBy</c> over every session recorded in the trailing
/// 371-day window on every single read. That cost grew without bound with the number of sessions
/// while answering a question whose answer only ever changes by one session at a time, which is
/// exactly what a projection is for.
/// </remarks>
/// <param name="BucketKey">The day/provider/agent/purpose/model bucket this row accumulates.</param>
/// <param name="Day">The calendar day the usage falls in (UTC).</param>
/// <param name="ProviderId">The AI provider that served the work - <see langword="null"/> when none was resolved.</param>
/// <param name="AgentId">The agent that did the work - <see langword="null"/> when none was resolved.</param>
/// <param name="Purpose">What the sessions that day were for.</param>
/// <param name="Model">The model the work ran on.</param>
/// <param name="Sessions">How many agent sessions were recorded that day.</param>
/// <param name="InputTokens">The input tokens those sessions consumed.</param>
/// <param name="OutputTokens">The output tokens those sessions produced.</param>
/// <param name="CachedTokens">The prompt tokens those sessions had served from the provider's own cache.</param>
/// <param name="Cost">The reported cost of those sessions, in USD.</param>
/// <param name="DurationMs">How long those sessions ran in total, in milliseconds.</param>
/// <param name="CpuSeconds">The CPU time those sessions consumed in total - what answers "how much CPU went to investigation versus planning versus implementation" once bucketed by <see cref="Purpose"/>.</param>
/// <param name="MemoryBytes">The peak memory those sessions consumed, summed - the same convention <c>AgentUsageByWeek</c>/<c>AgentUsageByMonth</c> already use for a resource figure that is really a per-session peak, not a naturally additive quantity.</param>
[ReadModel]
[FromEvent<AgentSessionUsageRecorded>(key: nameof(AgentSessionUsageRecorded.DailyBucketKey))]
public record AgentUsageByDay(
    [Key][SetFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.DailyBucketKey))] AgentUsageBucketKey BucketKey,
    [Index][SetFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.DayKey))] DayKey Day,
    [SetFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.Provider))] AIProviderId? ProviderId,
    [SetFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.Agent))] AgentId? AgentId,
    [SetFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.Purpose))] LanguageModelPurpose Purpose,
    [SetFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.Model))] ModelName Model,
    [Count<AgentSessionUsageRecorded>] int Sessions,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.InputTokens))] long InputTokens,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.OutputTokens))] long OutputTokens,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.CachedTokens))] long CachedTokens,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.CostUsd))] decimal Cost,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.Duration))] long DurationMs,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.CpuSeconds))] decimal CpuSeconds,
    [AddFrom<AgentSessionUsageRecorded>(nameof(AgentSessionUsageRecorded.MemoryBytes))] long MemoryBytes)
{
    /// <summary>
    /// How far back a usage page's activity view typically reaches - enough for a full year of
    /// heatmap columns plus the trailing week the details tables usually need.
    /// </summary>
    public static readonly TimeSpan Window = TimeSpan.FromDays(371);

    /// <summary>
    /// Gets the total time the sessions in this bucket ran for.
    /// </summary>
    public TimeSpan Duration => TimeSpan.FromMilliseconds(DurationMs);

    /// <summary>
    /// Gets every day's usage within the trailing window, oldest day first, bucketed per
    /// provider/agent/purpose/model combination so a consumer's page can narrow by any of them.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the daily buckets.</param>
    /// <param name="timeProvider">The <see cref="TimeProvider"/> for the trailing window.</param>
    /// <returns>The daily usage rows, oldest first.</returns>
    public static async Task<IEnumerable<AgentUsageByDay>> LastYear(
        IMongoCollection<AgentUsageByDay> collection,
        TimeProvider timeProvider)
    {
        var cutoff = DayKey.For(timeProvider.GetUtcNow() - Window);
        var rows = await (await collection.FindAsync(row => row.Day >= cutoff)).ToListAsync();
        return rows.OrderBy(row => row.Day.Value);
    }
}
