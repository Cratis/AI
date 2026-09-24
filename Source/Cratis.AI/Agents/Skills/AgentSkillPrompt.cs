// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;

namespace Cratis.AI.Agents.Skills;

/// <summary>
/// Turns an agent's configured skills into the standing instructions it carries into whatever it is
/// asked to do.
/// </summary>
/// <remarks>
/// Lives here rather than beside either caller because both need exactly the same thing: an agent's
/// skills are part of what that agent <em>is</em>, whether it runs as a worker container driving a
/// CLI harness or reasons in-process through a chat completion. Composing them differently per call
/// site is how one of the two ends up silently ignoring what somebody configured.
/// </remarks>
public static class AgentSkillPrompt
{
    /// <summary>
    /// The standing instructions for an agent's skills.
    /// </summary>
    /// <param name="skills">The agent's skills - a skill whose content was never written has nothing to teach and is left out.</param>
    /// <returns>The instructions, or an empty string when the agent has nothing to add.</returns>
    public static string For(IReadOnlyList<AgentSkill>? skills)
    {
        var teachable = (skills ?? []).Where(skill => !string.IsNullOrWhiteSpace(skill.Content?.Value)).ToList();
        if (teachable.Count == 0)
        {
            return string.Empty;
        }

        var builder = new StringBuilder()
            .AppendLine("Skills you have been given - knowledge to apply wherever it is relevant:");
        foreach (var skill in teachable)
        {
            builder
                .AppendLine()
                .AppendLine($"### {skill.Name.Value}")
                .AppendLine(skill.Content!.Value);
        }

        return builder.ToString();
    }

    /// <summary>
    /// Puts an agent's standing instructions in front of a prompt.
    /// </summary>
    /// <param name="prompt">The prompt to prefix.</param>
    /// <param name="skills">The agent's skills.</param>
    /// <returns>The prompt, with the standing instructions ahead of it when there are any.</returns>
    public static string Ahead(string prompt, IReadOnlyList<AgentSkill>? skills)
    {
        var standing = For(skills);
        return standing.Length == 0 ? prompt : $"{standing}\n{prompt}";
    }
}
