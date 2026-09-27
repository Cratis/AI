// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using MongoDB.Driver;

namespace Cratis.AI.Decisions.Usage;

/// <summary>
/// One day's decision usage for one engine, model and topic - what a usage page sums to show what
/// decisions cost, the same way <see cref="Cratis.AI.Usage.Daily.AgentUsageByDay"/> does for agents.
/// </summary>
/// <param name="BucketKey">The day/engine/model/topic bucket this row accumulates.</param>
/// <param name="Day">The calendar day the usage falls in (UTC).</param>
/// <param name="Engine">The engine that answered.</param>
/// <param name="Model">The model that answered.</param>
/// <param name="Topic">What the decisions were about.</param>
/// <param name="Calls">How many calls were made to the engine.</param>
/// <param name="Decisions">How many decisions those calls answered.</param>
/// <param name="Choices">How many choices were weighed across them.</param>
/// <param name="InputTokens">The input tokens the engine reported.</param>
/// <param name="OutputTokens">The output tokens the engine reported.</param>
/// <param name="DurationMs">How long the calls took in total, in milliseconds.</param>
[ReadModel]
[FromEvent<DecisionUsageRecorded>(key: nameof(DecisionUsageRecorded.DailyBucketKey))]
public record DecisionUsageByDay(
    [Key][SetFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.DailyBucketKey))] DecisionUsageBucketKey BucketKey,
    [Index][SetFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.DayKey))] DayKey Day,
    [SetFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.Engine))] DecisionEngineType Engine,
    [SetFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.Model))] ModelName Model,
    [SetFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.Topic))] DecisionTopic Topic,
    [Count<DecisionUsageRecorded>] int Calls,
    [AddFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.Decisions))] long Decisions,
    [AddFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.Choices))] long Choices,
    [AddFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.InputTokens))] long InputTokens,
    [AddFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.OutputTokens))] long OutputTokens,
    [AddFrom<DecisionUsageRecorded>(nameof(DecisionUsageRecorded.Duration))] long DurationMs)
{
    /// <summary>
    /// How far back the decision usage a settings page shows reaches.
    /// </summary>
    public static readonly TimeSpan Window = TimeSpan.FromDays(30);

    /// <summary>
    /// Gets every day's decision usage within the trailing thirty days, oldest day first.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the daily buckets.</param>
    /// <param name="timeProvider">The <see cref="TimeProvider"/> for the trailing window.</param>
    /// <returns>The daily usage rows, oldest first.</returns>
    public static async Task<IEnumerable<DecisionUsageByDay>> DecisionUsageForLastThirtyDays(
        IMongoCollection<DecisionUsageByDay> collection,
        TimeProvider timeProvider)
    {
        var cutoff = DayKey.For(timeProvider.GetUtcNow() - Window);
        var rows = await (await collection.FindAsync(row => row.Day >= cutoff)).ToListAsync();
        return rows.OrderBy(row => row.Day.Value);
    }
}
