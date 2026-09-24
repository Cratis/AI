// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents.Skills.Removing.when_removing_a_skill;

public class and_the_skill_is_unknown : Specification
{
    static readonly AgentId _agent = AgentId.For("IssueTriage");

    CommandScenario<RemoveAgentSkill> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RemoveAgentSkill(_agent, SkillId.New()));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
