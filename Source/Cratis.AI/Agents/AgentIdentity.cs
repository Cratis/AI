// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using ChronicleIdentity = Cratis.Chronicle.Identities.Identity;

namespace Cratis.AI.Agents;

/// <summary>
/// Maps an agent onto the <see cref="ChronicleIdentity"/> Chronicle stamps every event it causes with,
/// so the event log names the agent that did the work rather than a featureless system identity.
/// </summary>
/// <remarks>
/// Ported from Direct's <c>Identity.AgentIdentity</c> (plan Section 5.1 / 5.5, and the identity design
/// note from the consolidation session: every event an agent-driven task produces must be attributed
/// to the agent, not the system). The subject is the agent's own <see cref="AgentId"/>: it is a stable
/// identifier unrelated to any human subject space a consumer's own identity provider resolves, so it
/// cannot collide with one.
/// </remarks>
public static class AgentIdentity
{
    /// <summary>
    /// Gets the Chronicle identity for an agent.
    /// </summary>
    /// <param name="id">The <see cref="AgentId"/> of the agent.</param>
    /// <param name="name">The agent's display name.</param>
    /// <returns>The <see cref="ChronicleIdentity"/>.</returns>
    public static ChronicleIdentity For(AgentId id, AgentName name) => new(id.Value, name.Value, id.Value);
}
