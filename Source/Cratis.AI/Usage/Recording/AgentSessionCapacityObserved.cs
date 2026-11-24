// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Capacity;

namespace Cratis.AI.Usage.Recording;

/// <summary>
/// The package-owned boundary at which allowance was observed; not an inferred work outcome.
/// </summary>
public enum AgentSessionCapacityBoundaryKind
{
    /// <summary>
    /// Ordinary session usage was recorded at an existing usage-writing point.
    /// </summary>
    UsageRecorded = 0
}

/// <summary>
/// Provider-wide allowance as observed at a session-usage boundary, not usage to sum or subtract.
/// </summary>
/// <param name="Session">The session whose stream carries this fact.</param>
/// <param name="Agent">The acting agent.</param>
/// <param name="Purpose">The work's purpose.</param>
/// <param name="Boundary">The boundary whose facts share this stream write.</param>
/// <param name="Snapshot">The actual provider's allowance observation.</param>
[EventType(EventTypeId)]
public record AgentSessionCapacityObserved(AgentSessionId Session, AgentId Agent, LanguageModelPurpose Purpose, AgentSessionCapacityBoundaryKind Boundary, AIProviderCapacitySnapshot Snapshot)
{
    /// <summary>
    /// The pinned identity of this additive fact. Existing usage event identities remain unchanged.
    /// </summary>
    public const string EventTypeId = "818a86e0-994c-42a2-a466-2265201f5198";
}
