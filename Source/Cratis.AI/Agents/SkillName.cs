// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents;

/// <summary>
/// The name of a skill on an agent - the label its pill shows, such as "Event modeling".
/// </summary>
/// <param name="Value">The underlying value.</param>
public record SkillName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset skill name.
    /// </summary>
    public static readonly SkillName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="SkillName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator SkillName(string value) => new(value);

    /// <summary>
    /// Implicitly convert from <see cref="SkillName"/> to <see cref="string"/>.
    /// </summary>
    /// <param name="name">The name to convert from.</param>
    public static implicit operator string(SkillName name) => name.Value;
}
