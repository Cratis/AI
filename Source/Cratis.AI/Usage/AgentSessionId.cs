// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;

namespace Cratis.AI.Usage;

/// <summary>
/// The identity of one bounded run of agent work - a single completion, a conversation, or a
/// harness-run worker session. Everything the usage subsystem records is keyed off this rather than
/// off a product's own work/issue identifiers (plan Section 5.3): what the session is <em>for</em> is
/// resolved separately, by <c>Abstractions.IAIUsageAttribution</c>, so the package stays product-neutral.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AgentSessionId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an unset agent session identity.
    /// </summary>
    public static readonly AgentSessionId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AgentSessionId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AgentSessionId(string value) => new(value);

    /// <summary>
    /// Creates a new, unique <see cref="AgentSessionId"/>.
    /// </summary>
    /// <returns>A new <see cref="AgentSessionId"/>.</returns>
    public static AgentSessionId New() => new(Guid.NewGuid().ToString());
}
