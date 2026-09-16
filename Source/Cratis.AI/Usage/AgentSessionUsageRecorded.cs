// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Usage;

/// <summary>
/// Recorded when an agent session - a single completion, a conversation turn, or a harness-run
/// worker session - reports its usage. The one event type the package's usage subsystem produces,
/// generalizing Direct's <c>IssueAgentSessionUsageRecorded</c> (CPU/memory, keyed on issue) and
/// subsuming Direct's <c>LanguageModelUsageRecorded</c> and Studio's <c>LlmTokensConsumed</c> (plan
/// Section 5.3b).
/// </summary>
/// <param name="Session">The <see cref="AgentSessionId"/> the usage was recorded for - also this event's own stream.</param>
/// <param name="Agent">The <see cref="AgentId"/> that did the work.</param>
/// <param name="Provider">The <see cref="AIProviderId"/> that served it, when resolved through a configured provider.</param>
/// <param name="Model">The model that served it.</param>
/// <param name="Harness">The <see cref="Harnesses.Harness"/> the session ran under, when it was a harness-run job rather than a direct completion.</param>
/// <param name="Purpose">What the call was for.</param>
/// <param name="InputTokens">Tokens the prompt consumed.</param>
/// <param name="OutputTokens">Tokens the completion produced.</param>
/// <param name="CachedTokens">Prompt tokens served from the provider's own cache.</param>
/// <param name="CostUsd">The reported cost, in USD.</param>
/// <param name="CpuSeconds">The CPU time a harness measured for the session - zero for a direct completion.</param>
/// <param name="MemoryBytes">The peak memory a harness measured for the session - zero for a direct completion.</param>
/// <param name="Duration">How long the session took.</param>
/// <param name="WeekKey">The calendar week the session ran in, precomputed at command time.</param>
/// <param name="MonthKey">The calendar month the session ran in, precomputed at command time.</param>
/// <remarks>
/// <para>
/// <b>No organization/tenant property, deliberately</b> - Chronicle tenant isolation answers "whose"
/// by where the event landed, the same rationale Studio's own <c>LlmTokensConsumed</c> already
/// documents. Do not add one.
/// </para>
/// <para>
/// <see cref="WeekKey"/>/<see cref="MonthKey"/> are precomputed at command time rather than derived
/// from <c>EventContext.Occurred</c> at projection time - Chronicle's model-bound/fluent key
/// resolution only accepts event properties, so a composite key derived from the event's own
/// timestamp has nowhere else to come from. This is a deliberate, narrow exception to not
/// duplicating <c>EventContext.Occurred</c> on events; Direct's <c>RecordAgentSessionUsage.Provide</c>
/// documents the same reasoning.
/// </para>
/// <para>
/// Cross-stream fan-out to a product's own domain (Direct: one event per <c>IssueId</c> the work
/// covered) is a consumer concern, resolved through <see cref="Abstractions.IAIUsageAttribution"/> -
/// this event only ever appends on <see cref="Session"/>'s own stream.
/// </para>
/// <para>
/// <b>The explicit id is pinned and must never change</b> without going through the event-evolution
/// procedure in <c>Documentation/decisions/0002-event-evolution-no-migrations.md</c> - moving this
/// record between assemblies keeps the id, renaming it does not (plan Section 12.2).
/// </para>
/// </remarks>
[EventType(EventTypeId)]
public record AgentSessionUsageRecorded(
    AgentSessionId Session,
    AgentId Agent,
    AIProviderId? Provider,
    ModelName Model,
    Harness? Harness,
    LanguageModelPurpose Purpose,
    InputTokens InputTokens,
    OutputTokens OutputTokens,
    CachedTokens CachedTokens,
    CostUsd CostUsd,
    CpuSeconds CpuSeconds,
    MemoryBytes MemoryBytes,
    DurationMilliseconds Duration,
    WeekKey WeekKey,
    MonthKey MonthKey)
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type. Chosen once, here, and
    /// never changed - see the remarks above and decision 0002.
    /// </summary>
    public const string EventTypeId = "f16f9c1a-6b0a-4c8e-9c7c-2f0f9b7c5a01";
}
