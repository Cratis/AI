// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents;

/// <summary>
/// What the role behind one of the Direct's own reasoning jobs does, in a sentence.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AgentDescription(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no description.
    /// </summary>
    public static readonly AgentDescription NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AgentDescription"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AgentDescription(string value) => new(value);
}
