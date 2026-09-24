// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Skills.Adding;
using Cratis.AI.Agents.Skills.Removing;
using Cratis.AI.Agents.Skills.Updating;

namespace Cratis.AI.Agents.Skills;

/// <summary>
/// A skill as it lives on the agent read model - projected per skill id from the skill facts on the
/// agent's stream.
/// </summary>
/// <param name="SkillId">The skill's identity within its agent.</param>
/// <param name="Name">The skill's name.</param>
/// <param name="Content">What the skill teaches - <see langword="null"/> for a skill that has never had content written.</param>
[FromEvent<AgentSkillAdded>(key: nameof(AgentSkillAdded.SkillId))]
[FromEvent<AgentSkillRenamed>(key: nameof(AgentSkillRenamed.SkillId))]
[FromEvent<AgentSkillContentWritten>(key: nameof(AgentSkillContentWritten.SkillId))]
[RemovedWith<AgentSkillRemoved>(key: nameof(AgentSkillRemoved.SkillId))]
public record AgentSkill([Key] SkillId SkillId, SkillName Name, SkillContent? Content);
