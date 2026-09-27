// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// The identity of the decision engine configuration. There is only ever one engine in force, so
/// every configuration event is recorded under the same well-known identity.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DecisionEngineId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The one identity the decision engine configuration is recorded under.
    /// </summary>
    public static readonly DecisionEngineId Default = new("decision-engine");

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="DecisionEngineId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DecisionEngineId(string value) => new(value);
}
