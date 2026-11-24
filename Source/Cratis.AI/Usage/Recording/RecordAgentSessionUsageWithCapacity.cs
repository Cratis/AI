// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Capacity;
using Cratis.Arc.Authorization;
using Cratis.Chronicle;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Cratis.AI.Usage.Recording;

/// <summary>
/// Records ordinary usage followed by one cache-only allowance observation on the same session stream.
/// The legacy command and event remain unchanged; allowance is provider-wide, never a task cost.
/// </summary>
/// <param name="Session">The session's stream identity.</param>
/// <param name="Agent">The acting agent.</param>
/// <param name="Model">The actual model.</param>
/// <param name="Purpose">The work's purpose.</param>
/// <param name="Provider">The actual provider, absent if unresolved.</param>
/// <param name="Harness">The harness that measured the usage, if any.</param>
/// <param name="InputTokens">Reported input tokens.</param>
/// <param name="OutputTokens">Reported output tokens.</param>
/// <param name="CachedTokens">Reported cached tokens.</param>
/// <param name="CostUsd">Reported cost.</param>
/// <param name="CpuSeconds">Reported CPU time.</param>
/// <param name="MemoryBytes">Reported memory.</param>
/// <param name="Duration">Reported duration.</param>
[Command]
[Authorize(Policy = AIManagementPolicy.Name)]
public record RecordAgentSessionUsageWithCapacity(
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
    DurationMilliseconds? Duration = null) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => Session;

    /// <summary>
    /// Captures once using only cached information. Capture failure cannot suppress the usage event.
    /// </summary>
    /// <param name="timeProvider">The boundary clock.</param>
    /// <param name="snapshots">The cache-only capture capability.</param>
    /// <param name="logger">The logger for sanitized capture failures.</param>
    /// <returns>The prepared legacy usage event and the boundary snapshot.</returns>
    public AgentSessionUsageBoundary Provide(TimeProvider timeProvider, IAIProviderCapacitySnapshots snapshots, ILogger<RecordAgentSessionUsageWithCapacity>? logger = null)
    {
        var legacy = Legacy();
        var usage = legacy.Handle(legacy.Provide(timeProvider)).Item2;
        var provider = Provider ?? AIProviderId.NotSet;
        var now = timeProvider.GetUtcNow();
        AIProviderCapacitySnapshot snapshot;
        try
        {
            snapshot = provider == AIProviderId.NotSet
                ? AIProviderCapacitySnapshot.Unavailable(provider, now, AIProviderCapacitySnapshotReason.ProviderNotResolved)
                : snapshots.Capture(provider);
        }
        catch (Exception)
        {
            RecordAgentSessionUsageWithCapacityLogging.CaptureFailed(logger ?? NullLogger<RecordAgentSessionUsageWithCapacity>.Instance, provider);
            snapshot = AIProviderCapacitySnapshot.Unavailable(provider, now, AIProviderCapacitySnapshotReason.CaptureFailed);
        }

        return new(usage, snapshot);
    }

    /// <summary>
    /// Emits the unchanged usage event first and the independent allowance fact second.
    /// </summary>
    /// <param name="boundary">The prepared boundary facts.</param>
    /// <returns>Exactly two ordered events, neither a duplicate usage record.</returns>
    public IEnumerable<object> Handle(AgentSessionUsageBoundary boundary) =>
        [boundary.Usage, new AgentSessionCapacityObserved(boundary.Usage.Session, boundary.Usage.Agent, boundary.Usage.Purpose, AgentSessionCapacityBoundaryKind.UsageRecorded, boundary.Snapshot)];

    RecordAgentSessionUsage Legacy() => new(Session, Agent, Model, Purpose, Provider, Harness, InputTokens, OutputTokens, CachedTokens, CostUsd, CpuSeconds, MemoryBytes, Duration);
}

/// <summary>
/// Prepared data for a usage boundary; not a command or persisted event.
/// </summary>
/// <param name="Usage">The unchanged legacy event, prepared once.</param>
/// <param name="Snapshot">The one cache-only observation.</param>
public record AgentSessionUsageBoundary(AgentSessionUsageRecorded Usage, AIProviderCapacitySnapshot Snapshot);

internal static partial class RecordAgentSessionUsageWithCapacityLogging
{
    [LoggerMessage(LogLevel.Warning, "Allowance capture failed for provider {Provider}; recording an unavailable observation")]
    internal static partial void CaptureFailed(ILogger<RecordAgentSessionUsageWithCapacity> logger, AIProviderId provider);
}
