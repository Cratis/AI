// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents;

/// <summary>
/// The display name of an agent - what a human reads in the event log and in the UI where
/// <see cref="AgentId"/> would only be the wire identity.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AgentName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset agent name.
    /// </summary>
    public static readonly AgentName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AgentName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AgentName(string value) => new(value);
}
