// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Usage.Daily;

namespace Cratis.AI.Usage;

/// <summary>
/// Command for recording one agent session's usage - accepts the full harness callback payload shape
/// (<c>status, detail, inputTokens, outputTokens, costUsd, durationMs, cpuSeconds, memoryBytes</c>,
/// plus the resolution context a direct completion already has to hand) so both harness-run worker
/// sessions and in-process completions record through the one command (plan Section 5.3c).
/// </summary>
/// <param name="Session">The <see cref="AgentSessionId"/> the usage belongs to.</param>
/// <param name="Agent">The <see cref="AgentId"/> that did the work.</param>
/// <param name="Model">The model that served it.</param>
/// <param name="Purpose">What the call was for.</param>
/// <param name="Provider">The <see cref="AIProviderId"/> that served it, when resolved through a configured provider.</param>
/// <param name="Harness">The <see cref="Harnesses.Harness"/> the session ran under, when it was a harness-run job.</param>
/// <param name="InputTokens">Tokens the prompt consumed.</param>
/// <param name="OutputTokens">Tokens the completion produced.</param>
/// <param name="CachedTokens">Prompt tokens served from the provider's own cache.</param>
/// <param name="CostUsd">The reported cost, in USD.</param>
/// <param name="CpuSeconds">The CPU time a harness measured for the session.</param>
/// <param name="MemoryBytes">The peak memory a harness measured for the session.</param>
/// <param name="Duration">How long the session took.</param>
[Command]
public record RecordAgentSessionUsage(
    AgentSessionId Session,
    AgentId Agent,
    ModelName Model,
    LanguageModelPurpose Purpose,
    AIProviderId? Provider = null,
    Harness? Harness = null,
    InputTokens? InputTokens = null,
    OutputTokens? OutputTokens = null,
    CachedTokens? CachedTokens = null,
    CostUsd? CostUsd = null,
    CpuSeconds? CpuSeconds = null,
    MemoryBytes? MemoryBytes = null,
    DurationMilliseconds? Duration = null)
{
    /// <summary>
    /// Resolves the calendar day/week/month the session's usage falls into - see
    /// <see cref="AgentSessionUsageRecorded"/>'s remarks for why this is precomputed here rather than
    /// derived from <c>EventContext.Occurred</c> at projection time.
    /// </summary>
    /// <param name="timeProvider">The <see cref="TimeProvider"/> the day/week/month are computed from.</param>
    /// <returns>The <see cref="DayKey"/>/<see cref="WeekKey"/>/<see cref="MonthKey"/> triple.</returns>
    public UsagePeriod Provide(TimeProvider timeProvider)
    {
        var now = timeProvider.GetUtcNow();
        var day = DayKey.For(now);
        return new UsagePeriod(
            WeekKey.For(now),
            MonthKey.For(now),
            day,
            AgentUsageBucketKey.For(day, Provider, Agent, Purpose, Model));
    }

    /// <summary>
    /// Handles the command by appending an <see cref="AgentSessionUsageRecorded"/> event on the
    /// session's own stream.
    /// </summary>
    /// <param name="period">The resolved day/week/month the session falls into.</param>
    /// <returns>The session's identity, and the event to append on it.</returns>
    public (AgentSessionId, AgentSessionUsageRecorded) Handle(UsagePeriod period) =>
        (Session, new AgentSessionUsageRecorded(
            Session,
            Agent,
            Provider,
            Model,
            Harness,
            Purpose,
            InputTokens ?? Usage.InputTokens.NotSet,
            OutputTokens ?? Usage.OutputTokens.NotSet,
            CachedTokens ?? Usage.CachedTokens.NotSet,
            CostUsd ?? Usage.CostUsd.NotSet,
            CpuSeconds ?? Usage.CpuSeconds.NotSet,
            MemoryBytes ?? Usage.MemoryBytes.NotSet,
            Duration ?? DurationMilliseconds.NotSet,
            period.Week,
            period.Month,
            period.Day,
            period.DailyBucket));
}

// No explicit RecordAgentSessionUsageValidator: every optional figure on this command is a
// ConceptAs<T> (InputTokens, OutputTokens, CachedTokens, CostUsd, CpuSeconds, MemoryBytes,
// DurationMilliseconds), and Arc's IModelGraphValidator already walks the whole command graph and
// applies each concept's own ConceptValidator (CpuSecondsValidator, CostUsdValidator, ...)
// automatically whenever a value is present - the same traversal a query argument gets. A command-
// level validator re-declaring "cannot be negative" here would be pure duplication of what the
// concept validators already guarantee, and an earlier version of this file did exactly that
// (RuleFor(_ => _.CostUsd!.Value)...) - which additionally broke @cratis/ai's generated TypeScript:
// the ProxyGenerator translates a command validator's property-chain expression literally, and
// "CostUsd!.Value" became a nonsensical "c.costUsd.Value" access on a TS property already flattened
// to a plain number. Validate at the concept, not the command, for exactly this class of property.
