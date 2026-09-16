// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Usage.Daily;

/// <summary>
/// One recorded agent session's usage, as <see cref="AgentUsageByDay.LastYear"/> buckets it - the
/// projection of <see cref="AgentSessionUsageRecorded"/> the query reads from.
/// </summary>
/// <param name="Occurred">When the session's usage was recorded.</param>
/// <param name="ProviderId">The AI provider that served the work.</param>
/// <param name="AgentId">The agent that did the work.</param>
/// <param name="Purpose">What the session was for.</param>
/// <param name="Model">The model the session ran on.</param>
/// <param name="InputTokens">Tokens the prompt consumed.</param>
/// <param name="OutputTokens">Tokens the completion produced.</param>
/// <param name="Cost">The reported cost, in USD.</param>
/// <param name="DurationMs">How long the session took, in milliseconds.</param>
/// <param name="CpuSeconds">The CPU time a harness measured for the session - zero for a direct completion.</param>
/// <param name="MemoryBytes">The peak memory a harness measured for the session - zero for a direct completion.</param>
/// <remarks>
/// <see cref="CpuSeconds"/>/<see cref="MemoryBytes"/> joined <see cref="Purpose"/> here rather than at
/// the top-level <c>AgentSessionUsageRecorded</c> event, which already carried both from day one -
/// this is the read side finally exposing what the write side had all along, so "how much CPU/memory
/// went to investigation versus planning versus implementation" is answerable per agent, not only
/// per-week totals with no purpose breakdown. Purely additive - both default to zero for any session
/// recorded before this existed, exactly like every other unset figure on the event.
/// </remarks>
public record RecordedAgentSession(
    DateTimeOffset Occurred,
    AIProviderId? ProviderId,
    AgentId? AgentId,
    LanguageModelPurpose Purpose,
    ModelName Model,
    long InputTokens,
    long OutputTokens,
    decimal Cost,
    long DurationMs,
    decimal CpuSeconds = 0m,
    long MemoryBytes = 0L);

