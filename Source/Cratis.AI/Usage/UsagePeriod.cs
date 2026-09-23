// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Usage.Daily;

namespace Cratis.AI.Usage;

/// <summary>
/// The calendar day/week/month an agent session's usage falls into - the shape <see cref="RecordAgentSessionUsage.Provide"/>
/// resolves and <see cref="RecordAgentSessionUsage.Handle"/> consumes.
/// </summary>
/// <param name="Week">The calendar week.</param>
/// <param name="Month">The calendar month.</param>
/// <param name="Day">The calendar day (UTC).</param>
/// <param name="DailyBucket">The day/provider/agent/purpose/model bucket the daily usage accumulates under.</param>
public record UsagePeriod(WeekKey Week, MonthKey Month, DayKey Day, AgentUsageBucketKey DailyBucket);
