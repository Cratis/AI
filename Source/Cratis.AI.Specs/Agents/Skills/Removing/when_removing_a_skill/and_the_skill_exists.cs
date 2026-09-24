// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Skills.Removing.when_removing_a_skill;

/// <summary>
/// The known-skill rule needs an agent that has the skill, so the validator is exercised directly
/// with that state; the handler itself is a bare fact append.
/// </summary>
public class and_the_skill_exists : Specification
{
    static readonly AgentId _agentId = AgentId.For("IssueTriage");
    static readonly SkillId _skill = SkillId.New();

    RemoveAgentSkillValidator _validator;
    FluentValidation.Results.ValidationResult _result;
    AgentSkillRemoved _event;

    void Establish() =>
        _validator = new(new Agent(
            _agentId,
            "IssueTriage",
            "Scout",
            "Classifies issues.",
            ModelTier.Balanced,
            ProviderId: null,
            PoolId: null,
            Skills: [new(_skill, "Event modeling", "How to model events.")]));

    void Because()
    {
        _result = _validator.Validate(new RemoveAgentSkill(_agentId, _skill));
        _event = new RemoveAgentSkill(_agentId, _skill).Handle();
    }

    [Fact] void should_be_valid() => _result.IsValid.ShouldBeTrue();
    [Fact] void should_record_the_removal() => _event.ShouldEqual(new AgentSkillRemoved(_skill));
}
