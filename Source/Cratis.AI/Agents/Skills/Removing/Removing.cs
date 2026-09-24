// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;

namespace Cratis.AI.Agents.Skills.Removing;

/// <summary>
/// Command for removing a skill from an agent.
/// </summary>
/// <param name="Id">The agent the skill belongs to.</param>
/// <param name="Skill">The skill to remove.</param>
[Command]
public record RemoveAgentSkill(AgentId Id, SkillId Skill)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AgentSkillRemoved"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AgentSkillRemoved Handle() => new(Skill);
}

/// <summary>
/// Represents the validator for the <see cref="RemoveAgentSkill"/> command.
/// </summary>
public class RemoveAgentSkillValidator : CommandValidator<RemoveAgentSkill>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RemoveAgentSkillValidator"/> class.
    /// </summary>
    /// <param name="agent">The agent the skill belongs to - resolved by the command's event source.</param>
    public RemoveAgentSkillValidator(Agent? agent) =>
        RuleFor(_ => _.Skill)
            .Must(skill => AgentSkillRules.Has(agent, skill))
            .WithMessage(AgentSkillRules.UnknownSkill);
}

/// <summary>
/// Event raised when a skill has been removed from an agent.
/// </summary>
/// <param name="SkillId">The skill's identity within its agent.</param>
[EventType]
public record AgentSkillRemoved(SkillId SkillId);
