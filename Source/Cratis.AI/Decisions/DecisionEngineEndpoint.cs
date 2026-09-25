// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// The base address a decision engine is reached on.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DecisionEngineEndpoint(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no endpoint - the engine's own default applies.
    /// </summary>
    public static readonly DecisionEngineEndpoint NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="DecisionEngineEndpoint"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DecisionEngineEndpoint(string value) => new(value);
}
