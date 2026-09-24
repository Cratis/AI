// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Agents.Skills;
using Cratis.AI.Agents.Skills.Adding;
using Cratis.AI.Agents.Skills.Removing;
using Cratis.AI.Agents.Skills.Updating;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Listing.for_AIRole.when_projecting;

public class and_skills_are_added_renamed_written_and_removed : Specification
{
    static readonly AgentId _id = AgentId.For("IssueTriage");
    static readonly SkillId _removed = SkillId.New();
    static readonly SkillId _kept = SkillId.New();

    ReadModelScenario<Agent> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new AgentConfigured("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, ProviderId: null, PoolId: null, Harness.Claude, Effort.High),
                new AgentSkillAdded(_removed, "Old skill"),
                new AgentSkillContentWritten(_removed, "Old content."),
                new AgentSkillAdded(_kept, "Event modeling"),
                new AgentSkillRenamed(_kept, "Domain modeling"),
                new AgentSkillContentWritten(_kept, "How to model the domain."),
                new AgentSkillRemoved(_removed));

    [Fact] void should_keep_only_the_remaining_skill() => _scenario.Instance.Skills!.Select(skill => skill.SkillId).ShouldContainOnly(_kept);
    [Fact] void should_carry_the_renamed_name() => _scenario.Instance.Skills![0].Name.ShouldEqual(new SkillName("Domain modeling"));
    [Fact] void should_carry_the_written_content() => _scenario.Instance.Skills![0].Content.ShouldEqual(new SkillContent("How to model the domain."));
}
