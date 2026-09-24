// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;

namespace Cratis.AI.Agents.Skills;

/// <summary>
/// The rules the skill commands share, phrased against the agent's current skills.
/// </summary>
static class AgentSkillRules
{
    /// <summary>
    /// The rejection for a skill name the agent already uses.
    /// </summary>
    public const string DuplicateName = "The agent already has a skill with that name";

    /// <summary>
    /// The rejection for a skill the agent does not have.
    /// </summary>
    public const string UnknownSkill = "The agent has no such skill";

    /// <summary>
    /// Whether the agent already uses a skill name - case-insensitively, since two skills differing
    /// only in casing would be indistinguishable on their pills.
    /// </summary>
    /// <param name="agent">The agent - <see langword="null"/> when never configured.</param>
    /// <param name="name">The name to check.</param>
    /// <param name="exceptFor">A skill whose own name does not count - the one being renamed.</param>
    /// <returns><see langword="true"/> when the name is taken.</returns>
    public static bool NameIsTaken(Agent? agent, SkillName name, SkillId? exceptFor = null) =>
        (agent?.Skills ?? []).Any(skill => skill.SkillId != exceptFor && string.Equals(skill.Name, name, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Whether the agent has a skill.
    /// </summary>
    /// <param name="agent">The agent - <see langword="null"/> when never configured.</param>
    /// <param name="skill">The skill to look for.</param>
    /// <returns><see langword="true"/> when it does.</returns>
    public static bool Has(Agent? agent, SkillId skill) =>
        (agent?.Skills ?? []).Any(candidate => candidate.SkillId == skill);
}
