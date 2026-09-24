// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;
using Cratis.AI.Agents.Skills.Adding;

namespace Cratis.AI.Agents.Skills.Updating;

/// <summary>
/// Command for changing a skill on an agent - its name, its content, or both.
/// </summary>
/// <param name="Id">The agent the skill belongs to.</param>
/// <param name="Skill">The skill to change.</param>
/// <param name="Name">The skill's name.</param>
/// <param name="Content">What the skill teaches, in markdown.</param>
[Command]
public record UpdateAgentSkill(AgentId Id, SkillId Skill, SkillName Name, SkillContent Content)
{
    /// <summary>
    /// Handles the command by appending only the facts for what actually changed - a dialog that
    /// saves name and content together must not record a rename that never happened, because events
    /// are facts.
    /// </summary>
    /// <param name="agent">The agent the skill belongs to - resolved by the command's event source.</param>
    /// <returns>The events for the parts that changed - none when nothing did.</returns>
    public IEnumerable<object> Handle(Agent? agent)
    {
        var current = (agent?.Skills ?? []).FirstOrDefault(candidate => candidate.SkillId == Skill);
        var events = new List<object>();
        if (current?.Name != Name)
        {
            events.Add(new AgentSkillRenamed(Skill, Name));
        }

        if (current?.Content != Content)
        {
            events.Add(new AgentSkillContentWritten(Skill, Content));
        }

        return events;
    }
}

/// <summary>
/// Represents the validator for the <see cref="UpdateAgentSkill"/> command.
/// </summary>
public class UpdateAgentSkillValidator : CommandValidator<UpdateAgentSkill>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="UpdateAgentSkillValidator"/> class.
    /// </summary>
    /// <param name="agent">The agent the skill belongs to - resolved by the command's event source.</param>
    public UpdateAgentSkillValidator(Agent? agent)
    {
        RuleFor(_ => _.Name).NotEqual(SkillName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.Skill)
            .Must(skill => AgentSkillRules.Has(agent, skill))
            .WithMessage(AgentSkillRules.UnknownSkill);
        RuleFor(_ => _)
            .Must(command => !AgentSkillRules.NameIsTaken(agent, command.Name, command.Skill))
            .WithMessage(AgentSkillRules.DuplicateName);
    }
}

/// <summary>
/// Event raised when a skill on an agent has been renamed.
/// </summary>
/// <param name="SkillId">The skill's identity within its agent.</param>
/// <param name="Name">The new name.</param>
[EventType]
public record AgentSkillRenamed(SkillId SkillId, SkillName Name);
