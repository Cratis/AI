// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Usage.Daily;

/// <summary>
/// The key one <see cref="AgentUsageByDay"/> row accumulates under - one calendar day along one
/// provider/agent/purpose/model combination.
/// </summary>
/// <remarks>
/// Precomputed on <see cref="AgentSessionUsageRecorded"/> for the same reason
/// <see cref="Common.WeekKey"/>/<see cref="Common.MonthKey"/> are: Chronicle's model-bound key
/// resolution keys a projection on a single event property, so a composite bucket has nowhere else
/// to come from. Mirrors Direct's <c>AIUsage.DailyUsage.AgentUsageBucketKey</c>.
/// </remarks>
/// <param name="Value">The underlying value.</param>
public record AgentUsageBucketKey(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset bucket key.
    /// </summary>
    public static readonly AgentUsageBucketKey NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AgentUsageBucketKey"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AgentUsageBucketKey(string value) => new(value);

    /// <summary>
    /// Gets the <see cref="AgentUsageBucketKey"/> for a day and dimension combination.
    /// </summary>
    /// <param name="day">The calendar day the usage falls in.</param>
    /// <param name="provider">The provider that served the work, when one was resolved.</param>
    /// <param name="agent">The agent that did the work.</param>
    /// <param name="purpose">What the work was for.</param>
    /// <param name="model">The model the work ran on.</param>
    /// <returns>The resolved <see cref="AgentUsageBucketKey"/>.</returns>
    public static AgentUsageBucketKey For(
        DayKey day,
        AIProviderId? provider,
        AgentId? agent,
        LanguageModelPurpose purpose,
        ModelName model) =>
        $"{day}|{provider}|{agent}|{purpose}|{model}";
}
