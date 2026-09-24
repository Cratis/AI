// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Skills.Adding.when_adding_a_skill;

/// <summary>
/// The duplicate-name rule needs an agent that already has skills, so the validator is exercised
/// directly with that state rather than through the scenario pipeline.
/// </summary>
public class and_the_name_is_already_used_with_different_casing : Specification
{
    static readonly AgentId _agentId = AgentId.For("IssueTriage");

    AddAgentSkillValidator _validator;
    FluentValidation.Results.ValidationResult _result;

    void Establish() =>
        _validator = new(new Agent(
            _agentId,
            "IssueTriage",
            "Scout",
            "Classifies issues.",
            ModelTier.Balanced,
            ProviderId: null,
            PoolId: null,
            Skills: [new(SkillId.New(), "Event Modeling", "How to model events.")]));

    void Because() => _result = _validator.Validate(new AddAgentSkill(_agentId, "event modeling", "Different content."));

    [Fact] void should_not_be_valid() => _result.IsValid.ShouldBeFalse();
}
