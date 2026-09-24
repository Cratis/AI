// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents.Skills.Updating.when_updating_a_skill;

/// <summary>
/// An agent that has never been configured has no skills at all, so the update is rejected - the
/// same answer any unknown skill id gets.
/// </summary>
public class and_the_skill_is_unknown : Specification
{
    static readonly AgentId _agent = AgentId.For("IssueTriage");

    CommandScenario<UpdateAgentSkill> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new UpdateAgentSkill(_agent, SkillId.New(), "Event modeling", "Some content."));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
