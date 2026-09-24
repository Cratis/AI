// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Skills.Updating.when_updating_a_skill;

public class and_nothing_changed : Specification
{
    static readonly AgentId _agentId = AgentId.For("IssueTriage");
    static readonly SkillId _skill = SkillId.New();

    IEnumerable<object> _events;

    void Because() => _events = new UpdateAgentSkill(_agentId, _skill, "Event modeling", "Original content.")
        .Handle(AgentWith(new AgentSkill(_skill, "Event modeling", "Original content.")));

    [Fact] void should_record_nothing() => _events.ShouldBeEmpty();

    static Agent AgentWith(params AgentSkill[] skills) =>
        new(_agentId, "IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, ProviderId: null, PoolId: null, Skills: skills);
}
