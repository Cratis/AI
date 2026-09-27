// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Usage;

namespace Cratis.AI.Decisions.Usage;

/// <summary>
/// Command for recording what one call to a decision engine consumed - the decision counterpart of
/// <see cref="RecordAgentSessionUsage"/>, appended by <see cref="IDecisions"/> after every call
/// rather than by its callers.
/// </summary>
/// <param name="Usage">The identity of the call.</param>
/// <param name="Engine">The engine that answered.</param>
/// <param name="Model">The model that answered.</param>
/// <param name="Topic">What the decisions were about.</param>
/// <param name="Decisions">How many decisions the call answered.</param>
/// <param name="Choices">How many choices were weighed across them.</param>
/// <param name="InputTokens">The input tokens the engine reported.</param>
/// <param name="OutputTokens">The output tokens the engine reported.</param>
/// <param name="Duration">How long the call took.</param>
[Command]
public record RecordDecisionUsage(
    DecisionUsageId Usage,
    DecisionEngineType Engine,
    ModelName Model,
    DecisionTopic Topic,
    int Decisions,
    int Choices,
    InputTokens InputTokens,
    OutputTokens OutputTokens,
    DurationMilliseconds Duration)
{
    /// <summary>
    /// Resolves the day the usage falls in and the bucket it accumulates into.
    /// </summary>
    /// <param name="timeProvider">The <see cref="TimeProvider"/>.</param>
    /// <returns>The <see cref="DecisionUsagePeriod"/>.</returns>
    public DecisionUsagePeriod Provide(TimeProvider timeProvider)
    {
        var day = DayKey.For(timeProvider.GetUtcNow());
        return new(day, DecisionUsageBucketKey.For(day, Engine, Model, Topic));
    }

    /// <summary>
    /// Handles the command by appending a <see cref="DecisionUsageRecorded"/> event.
    /// </summary>
    /// <param name="period">The day and bucket from <see cref="Provide"/>.</param>
    /// <returns>A tuple of the usage identity (event source) and the event.</returns>
    public (DecisionUsageId, DecisionUsageRecorded) Handle(DecisionUsagePeriod period) =>
        (Usage, new DecisionUsageRecorded(Engine, Model, Topic, Decisions, Choices, InputTokens, OutputTokens, Duration, period.Day, period.Bucket));
}

/// <summary>
/// The day a decision's usage falls in and the bucket it accumulates into.
/// </summary>
/// <param name="Day">The day (UTC).</param>
/// <param name="Bucket">The day/engine/model/topic bucket.</param>
public record DecisionUsagePeriod(DayKey Day, DecisionUsageBucketKey Bucket);

/// <summary>
/// Event raised when a call to a decision engine has been recorded.
/// </summary>
/// <param name="Engine">The engine that answered.</param>
/// <param name="Model">The model that answered.</param>
/// <param name="Topic">What the decisions were about.</param>
/// <param name="Decisions">How many decisions the call answered.</param>
/// <param name="Choices">How many choices were weighed across them.</param>
/// <param name="InputTokens">The input tokens the engine reported - zero for an engine that reports none.</param>
/// <param name="OutputTokens">The output tokens the engine reported - zero for an engine that reports none.</param>
/// <param name="Duration">How long the call took.</param>
/// <param name="DayKey">The day the call was made (UTC).</param>
/// <param name="DailyBucketKey">The day/engine/model/topic bucket it accumulates into.</param>
[EventType]
public record DecisionUsageRecorded(
    DecisionEngineType Engine,
    ModelName Model,
    DecisionTopic Topic,
    int Decisions,
    int Choices,
    InputTokens InputTokens,
    OutputTokens OutputTokens,
    DurationMilliseconds Duration,
    DayKey DayKey,
    DecisionUsageBucketKey DailyBucketKey);
