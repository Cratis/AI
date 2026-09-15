// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

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
    /// Resolves the calendar week/month the session's usage falls into - see
    /// <see cref="AgentSessionUsageRecorded"/>'s remarks for why this is precomputed here rather than
    /// derived from <c>EventContext.Occurred</c> at projection time.
    /// </summary>
    /// <param name="timeProvider">The <see cref="TimeProvider"/> the week/month are computed from.</param>
    /// <returns>The <see cref="WeekKey"/>/<see cref="MonthKey"/> pair.</returns>
    public UsagePeriod Provide(TimeProvider timeProvider)
    {
        var now = timeProvider.GetUtcNow();
        return new UsagePeriod(WeekKey.For(now), MonthKey.For(now));
    }

    /// <summary>
    /// Handles the command by appending an <see cref="AgentSessionUsageRecorded"/> event on the
    /// session's own stream.
    /// </summary>
    /// <param name="period">The resolved week/month the session falls into.</param>
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
            period.Month));
}

/// <summary>
/// Represents the validator for the <see cref="RecordAgentSessionUsage"/> command. None of the
/// reported figures can be negative - a negative measurement is never real and, left unrejected,
/// would silently skew every usage figure derived from it (the same bug class Direct hit -
/// Cratis/Stagehand#747 - now caught at the command boundary rather than relying on each concept's
/// own validator alone, since several of these properties are optional here and a validator only
/// runs once the concept is constructed).
/// </summary>
public class RecordAgentSessionUsageValidator : CommandValidator<RecordAgentSessionUsage>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RecordAgentSessionUsageValidator"/> class.
    /// </summary>
    public RecordAgentSessionUsageValidator()
    {
        RuleFor(_ => _.InputTokens!.Value).GreaterThanOrEqualTo(0).When(_ => _.InputTokens is not null).WithMessage("Input tokens cannot be negative");
        RuleFor(_ => _.OutputTokens!.Value).GreaterThanOrEqualTo(0).When(_ => _.OutputTokens is not null).WithMessage("Output tokens cannot be negative");
        RuleFor(_ => _.CachedTokens!.Value).GreaterThanOrEqualTo(0).When(_ => _.CachedTokens is not null).WithMessage("Cached tokens cannot be negative");
        RuleFor(_ => _.CostUsd!.Value).GreaterThanOrEqualTo(0).When(_ => _.CostUsd is not null).WithMessage("A cost cannot be negative");
        RuleFor(_ => _.CpuSeconds!.Value).GreaterThanOrEqualTo(0).When(_ => _.CpuSeconds is not null).WithMessage("A CPU time cannot be negative");
        RuleFor(_ => _.MemoryBytes!.Value).GreaterThanOrEqualTo(0).When(_ => _.MemoryBytes is not null).WithMessage("A memory size cannot be negative");
        RuleFor(_ => _.Duration!.Value).GreaterThanOrEqualTo(0).When(_ => _.Duration is not null).WithMessage("A duration cannot be negative");
    }
}
