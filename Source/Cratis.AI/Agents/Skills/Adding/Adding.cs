// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;

namespace Cratis.AI.Agents.Skills.Adding;

/// <summary>
/// Command for giving an agent a skill - a named piece of markdown describing something the agent
/// knows and how to apply it, carried into the agent's prompt when it works. Same shape as Studio's
/// agent skills.
/// </summary>
/// <param name="Id">The agent the skill belongs to.</param>
/// <param name="Name">The skill's name - the label its pill shows.</param>
/// <param name="Content">What the skill teaches, in markdown.</param>
[Command]
public record AddAgentSkill(AgentId Id, SkillName Name, SkillContent Content)
{
    /// <summary>
    /// Handles the command by minting the skill's identity and appending the addition and its
    /// content as separate facts - content is its own fact so it can be rewritten without a
    /// rename ever being implied.
    /// </summary>
    /// <returns>The new skill's identity as the response, and the two events.</returns>
    public (SkillId, AgentSkillAdded, AgentSkillContentWritten) Handle()
    {
        var skillId = SkillId.New();
        return (skillId, new(skillId, Name), new(skillId, Content));
    }
}

/// <summary>
/// Represents the validator for the <see cref="AddAgentSkill"/> command.
/// </summary>
public class AddAgentSkillValidator : CommandValidator<AddAgentSkill>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddAgentSkillValidator"/> class.
    /// </summary>
    /// <param name="agent">The agent the skill is added to - resolved by the command's event source, <see langword="null"/> when it has never been configured.</param>
    public AddAgentSkillValidator(Agent? agent)
    {
        RuleFor(_ => _.Name).NotEqual(SkillName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.Name)
            .Must(name => !AgentSkillRules.NameIsTaken(agent, name))
            .WithMessage(AgentSkillRules.DuplicateName);
    }
}

/// <summary>
/// Event raised when an agent has been given a skill. The agent is the event source; the skill
/// carries its own identity so it can be renamed, rewritten and removed independently.
/// </summary>
/// <param name="SkillId">The skill's identity within its agent.</param>
/// <param name="Name">The skill's name.</param>
[EventType]
public record AgentSkillAdded(SkillId SkillId, SkillName Name);

/// <summary>
/// Event raised when a skill's content has been written - a fact of its own rather than a property
/// on the addition, so content can be rewritten any number of times without implying anything else
/// about the skill changed.
/// </summary>
/// <param name="SkillId">The skill's identity within its agent.</param>
/// <param name="Content">What the skill teaches, in markdown.</param>
[EventType]
public record AgentSkillContentWritten(SkillId SkillId, SkillContent Content);
