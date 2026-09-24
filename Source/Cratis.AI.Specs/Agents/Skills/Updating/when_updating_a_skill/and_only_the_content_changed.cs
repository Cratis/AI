// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Listing;
using Cratis.AI.Agents.Skills.Adding;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Skills.Updating.when_updating_a_skill;

/// <summary>
/// The dialog saves name and content together - the handler must record only the fact that actually
/// happened, never a rename that did not.
/// </summary>
public class and_only_the_content_changed : Specification
{
    static readonly AgentId _agentId = AgentId.For("IssueTriage");
    static readonly SkillId _skill = SkillId.New();

    IEnumerable<object> _events;

    void Because() => _events = new UpdateAgentSkill(_agentId, _skill, "Event modeling", "Rewritten content.")
        .Handle(AgentWith(new AgentSkill(_skill, "Event modeling", "Original content.")));

    [Fact] void should_record_the_content() => _events.ShouldContainOnly(new AgentSkillContentWritten(_skill, "Rewritten content."));
    [Fact] void should_not_record_a_rename_that_never_happened() => _events.OfType<AgentSkillRenamed>().ShouldBeEmpty();

    static Agent AgentWith(params AgentSkill[] skills) =>
        new(_agentId, "IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, ProviderId: null, PoolId: null, Skills: skills);
}
