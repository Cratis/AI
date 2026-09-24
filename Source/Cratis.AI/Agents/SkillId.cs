// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents;

/// <summary>
/// The identity of a skill on an agent. It identifies the skill within its agent - the agent remains
/// the event source - so this is a value concept rather than an event-source identity, the same
/// choice Studio's <c>SkillId</c> makes.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record SkillId(Guid Value) : ConceptAs<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset skill identity.
    /// </summary>
    public static readonly SkillId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="SkillId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator SkillId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique skill identity.
    /// </summary>
    /// <returns>The new identity.</returns>
    public static SkillId New() => new(Guid.NewGuid());
}
