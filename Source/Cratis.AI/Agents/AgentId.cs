// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents;

/// <summary>
/// The stable identity of an agent - the subject every event an agent causes is attributed to
/// through <see cref="AgentIdentity"/>, and the event source id of the agent's own stream when a
/// consumer chooses to keep one.
/// </summary>
/// <param name="Value">The underlying value.</param>
/// <remarks>
/// Ported from Direct's <c>Agents.AgentId</c> (plan Section 5.5) - kept as an
/// <see cref="EventSourceId{T}"/> of <see cref="string"/> for the same reason Direct's is: agents are
/// addressable event sources, not just a lookup key.
/// </remarks>
public record AgentId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an unset agent identity.
    /// </summary>
    public static readonly AgentId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AgentId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AgentId(string value) => new(value);
}
