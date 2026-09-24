// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reactive.Subjects;
using Cratis.AI.Agents.Configuring;
using Cratis.AI.Agents.Skills;
using Cratis.AI.Agents.Skills.Adding;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using MongoDB.Driver;

namespace Cratis.AI.Agents.Listing;

/// <summary>
/// Read model for the role behind one of the Direct's own reasoning jobs.
/// </summary>
/// <param name="Id">The role identity - one per purpose.</param>
/// <param name="Purpose">The reasoning job this role is for.</param>
/// <param name="Name">The role's display name.</param>
/// <param name="Description">What the role does, in a sentence.</param>
/// <param name="Tier">The capability tier this role asks for (#865) - the provider translates it into the concrete model it offers.</param>
/// <param name="ProviderId">The AI provider this role runs on - <see langword="null"/> leaves it unable to run until one is set.</param>
/// <param name="PoolId">The AI provider pool this role draws from - <see langword="null"/> when it names a provider directly, or nothing at all.</param>
/// <param name="Skills">The skills the agent has been given - <see langword="null"/> when it has none.</param>
/// <param name="Harness">The CLI harness the agent's job invocations run under - Pi unless configured otherwise; meaningless for chat agents.</param>
/// <param name="Effort">The reasoning effort the agent's AI provider runs completions at - High unless configured otherwise.</param>
/// <remarks>
/// <see cref="ProviderId"/> and <see cref="PoolId"/> deliberately carry no <c>= null</c> default -
/// worked around until Cratis/Chronicle#3847 is fixed, giving either of them a default value makes
/// <see cref="IReadModels.GetInstanceById{TReadModel}"/> silently return <see langword="null"/> for
/// it instead of the real stored value, even though the value is correctly persisted and correctly
/// visible through <c>ReadModelScenario&lt;Agent&gt;</c> in specs. That silently broke every chat
/// reply from a role that named an AI provider (issue #103) - the role read back as "no provider
/// configured" and every call fell through to the legacy fallback. This also happens to match the
/// house convention (no default values on <c>[ReadModel]</c> constructor parameters), so once the
/// Chronicle bug is fixed this remark - not the missing defaults - is what should be removed.
/// </remarks>
[ReadModel]
[FromEvent<AgentConfigured>]
public record Agent(
    AgentId Id,
    LanguageModelPurpose Purpose,
    AgentName Name,
    AgentDescription Description,
    ModelTier Tier,
    AIProviderId? ProviderId,
    AIProviderPoolId? PoolId,
    [ChildrenFrom<AgentSkillAdded>(key: nameof(AgentSkillAdded.SkillId))]
    IReadOnlyList<AgentSkill>? Skills = null,
    Harness Harness = Harness.Pi,
    Effort Effort = Effort.High)
{
    /// <summary>
    /// Observes every role that has been named - a purpose with no role recorded yet simply has none
    /// here; the frontend falls back to a built-in default name and description for it.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the roles.</param>
    /// <returns>An observable of every named role.</returns>
    public static ISubject<IEnumerable<Agent>> AllAgents(IMongoCollection<Agent> collection) =>
        collection.Observe();

    /// <summary>
    /// Gets the role recorded for a purpose, if one has been.
    /// </summary>
    /// <param name="readModels">The <see cref="IReadModels"/> to read from.</param>
    /// <param name="purpose">The purpose to look the role up for.</param>
    /// <returns>The role, or <see langword="null"/> when none has been recorded for it.</returns>
    public static async Task<Agent?> For(IReadModels readModels, LanguageModelPurpose purpose) =>
        await readModels.GetInstanceById<Agent>((EventSourceId)AgentId.For(purpose));
}
