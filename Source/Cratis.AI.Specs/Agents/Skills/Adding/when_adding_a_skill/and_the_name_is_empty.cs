// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents.Skills.Adding.when_adding_a_skill;

public class and_the_name_is_empty : Specification
{
    static readonly AgentId _agent = AgentId.For("IssueTriage");

    CommandScenario<AddAgentSkill> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new AddAgentSkill(_agent, SkillName.NotSet, "Some content."));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
