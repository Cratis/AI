// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Skills.Updating.when_updating_a_skill;

/// <summary>
/// Renaming onto a sibling's name is rejected, while keeping one's own name is not - the rule
/// excepts the skill being renamed, so the validator is exercised directly with that state.
/// </summary>
public class and_the_new_name_is_taken_by_another_skill : Specification
{
    static readonly AgentId _agentId = AgentId.For("IssueTriage");
    static readonly SkillId _skill = SkillId.New();

    UpdateAgentSkillValidator _validator;
    FluentValidation.Results.ValidationResult _renamedOntoSibling;
    FluentValidation.Results.ValidationResult _keptItsOwnName;

    void Establish() =>
        _validator = new(new Agent(
            _agentId,
            "IssueTriage",
            "Scout",
            "Classifies issues.",
            ModelTier.Balanced,
            ProviderId: null,
            PoolId: null,
            Skills:
            [
                new(_skill, "Event modeling", "How to model events."),
                new(SkillId.New(), "Projections", "How to project.")
            ]));

    void Because()
    {
        _renamedOntoSibling = _validator.Validate(new UpdateAgentSkill(_agentId, _skill, "Projections", "Content."));
        _keptItsOwnName = _validator.Validate(new UpdateAgentSkill(_agentId, _skill, "Event modeling", "Content."));
    }

    [Fact] void should_reject_a_siblings_name() => _renamedOntoSibling.IsValid.ShouldBeFalse();
    [Fact] void should_accept_keeping_its_own_name() => _keptItsOwnName.IsValid.ShouldBeTrue();
}
