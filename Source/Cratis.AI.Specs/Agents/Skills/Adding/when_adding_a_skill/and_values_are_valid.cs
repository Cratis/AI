// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents.Skills.Adding.when_adding_a_skill;

public class and_values_are_valid : Specification
{
    static readonly AgentId _agent = AgentId.For("IssueTriage");

    CommandScenario<AddAgentSkill> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new AddAgentSkill(_agent, "Event modeling", "Model events as past-tense facts."));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_the_addition() => _scenario.EventSequence.ShouldHaveAppendedEvent<AgentSkillAdded>(
        @event => @event.Name == new SkillName("Event modeling") && @event.SkillId != SkillId.NotSet);

    [Fact]
    void should_append_the_content_as_its_own_fact() => _scenario.EventSequence.ShouldHaveAppendedEvent<AgentSkillContentWritten>(
        @event => @event.Content == new SkillContent("Model events as past-tense facts."));
}
