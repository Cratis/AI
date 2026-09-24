// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents.Skills.Adding.when_adding_a_skill;

public class and_the_content_is_too_long : Specification
{
    static readonly AgentId _agent = AgentId.For("IssueTriage");

    CommandScenario<AddAgentSkill> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new AddAgentSkill(_agent, "Event modeling", new string('x', SkillContentValidator.MaximumLength + 1)));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
