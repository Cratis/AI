// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

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
/// Marked <c>[Passive]</c> because it has no accumulating projection of its own - it is computed on
/// demand from the recorded sessions, the same treatment Direct's original gets. Rows are bucketed
/// server-side so only the aggregates cross the wire, never a session list, no matter how far back
/// the window reaches.
/// </remarks>
/// <param name="Day">The calendar day the usage falls in (UTC).</param>
/// <param name="ProviderId">The AI provider that served the work - <see langword="null"/> when none was resolved.</param>
/// <param name="AgentId">The agent that did the work - <see langword="null"/> when none was resolved.</param>
/// <param name="Purpose">What the sessions that day were for.</param>
/// <param name="Model">The model the work ran on.</param>
/// <param name="Sessions">How many agent sessions were recorded that day.</param>
/// <param name="InputTokens">The input tokens those sessions consumed.</param>
/// <param name="OutputTokens">The output tokens those sessions produced.</param>
/// <param name="Cost">The reported cost of those sessions, in USD.</param>
/// <param name="Duration">How long those sessions ran in total.</param>
/// <param name="CpuSeconds">The CPU time those sessions consumed in total - what answers "how much CPU went to investigation versus planning versus implementation" once bucketed by <see cref="Purpose"/>.</param>
/// <param name="MemoryBytes">The peak memory those sessions consumed, summed - the same convention <c>AgentUsageByWeek</c>/<c>AgentUsageByMonth</c> already use for a resource figure that is really a per-session peak, not a naturally additive quantity.</param>
[ReadModel]
[Passive]
public record AgentUsageByDay(
    DateOnly Day,
    AIProviderId? ProviderId,
    AgentId? AgentId,
    LanguageModelPurpose Purpose,
    ModelName Model,
    int Sessions,
    long InputTokens,
    long OutputTokens,
    decimal Cost,
    TimeSpan Duration,
    decimal CpuSeconds = 0m,
    long MemoryBytes = 0L)
{
    /// <summary>
    /// How far back a usage page's activity view typically reaches - enough for a full year of
    /// heatmap columns plus the trailing week the details tables usually need.
    /// </summary>
    public static readonly TimeSpan Window = TimeSpan.FromDays(371);

    /// <summary>
    /// Gets every day's usage within the trailing window, oldest day first, bucketed per
    /// provider/agent/purpose/model combination so a consumer's page can narrow by any of them.
    /// </summary>
    /// <param name="sessions">The recorded agent sessions.</param>
    /// <param name="timeProvider">The <see cref="TimeProvider"/> for the trailing window.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The daily usage rows, oldest first.</returns>
    public static async Task<IEnumerable<AgentUsageByDay>> LastYear(
        IRecordedAgentSessions sessions,
        TimeProvider timeProvider,
        CancellationToken cancellationToken = default)
    {
        var cutoff = timeProvider.GetUtcNow() - Window;
        var recorded = await sessions.RecordedSince(cutoff, cancellationToken);

        return recorded
            .GroupBy(entry => (
                Day: DateOnly.FromDateTime(entry.Occurred.UtcDateTime),
                entry.ProviderId,
                entry.AgentId,
                entry.Purpose,
                entry.Model))
            .Select(group => new AgentUsageByDay(
                group.Key.Day,
                group.Key.ProviderId,
                group.Key.AgentId,
                group.Key.Purpose,
                group.Key.Model,
                group.Count(),
                group.Sum(entry => entry.InputTokens),
                group.Sum(entry => entry.OutputTokens),
                group.Sum(entry => entry.Cost),
                TimeSpan.FromMilliseconds(group.Sum(entry => entry.DurationMs)),
                group.Sum(entry => entry.CpuSeconds),
                group.Sum(entry => entry.MemoryBytes)))
            .OrderBy(row => row.Day);
    }
}

