// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.Arc.Authorization;

namespace Cratis.AI.Agents.Defining;

/// <summary>
/// Command for defining the role behind one of the Direct's own reasoning jobs and, separately,
/// where it runs: on a provider, on a pool of providers, or on nothing at all. The role and the
/// assignment are recorded as independent facts - <see cref="AgentRoleConfigured"/> followed by exactly
/// one of <see cref="AgentAssignedToProvider"/>, <see cref="AgentAssignedToPool"/> or
/// <see cref="AgentAssignmentCleared"/>.
/// </summary>
/// <remarks>
/// This is the write path new callers should use. <see cref="ConfigureAgent"/> is the legacy write path
/// that still records the combined <see cref="AgentConfigured"/> event; it is kept for compatibility
/// and is to be removed in a later major release. Provider and pool are mutually exclusive - the
/// validator refuses both. An agent with neither has no explicit assignment; routing for it is
/// unchanged by this command.
/// </remarks>
/// <param name="Purpose">The reasoning job this role is for.</param>
/// <param name="Name">The role's display name.</param>
/// <param name="Description">What the role does, in a sentence.</param>
/// <param name="Tier">The capability tier this role asks for - each provider translates the tier into the concrete model it offers for it.</param>
/// <param name="ProviderId">The AI provider this role runs on - <see langword="null"/> or not set for none. Mutually exclusive with <paramref name="PoolId"/>.</param>
/// <param name="PoolId">The AI provider pool this role draws from - <see langword="null"/> or not set for none. Mutually exclusive with <paramref name="ProviderId"/>.</param>
/// <param name="Harness">Deprecated per-agent harness preference, retained for older callers and fallback when a provider has no selection. Configure provider harnesses instead.</param>
/// <param name="Effort">The reasoning effort the agent's AI provider runs completions at - each <c>IAIProviderClient</c> translates it to its own vendor's mechanism.</param>
[Command]
[Authorize(Policy = AIManagementPolicy.Name)]
public record DefineAgent(LanguageModelPurpose Purpose, AgentName Name, AgentDescription Description, ModelTier Tier, AIProviderId? ProviderId = null, AIProviderPoolId? PoolId = null, Harness Harness = Harness.Pi, Effort Effort = Effort.High) : ICanProvideEventSourceId
{
    /// <summary>
    /// Gets the role's identity - one per purpose.
    /// </summary>
    /// <returns>The event source id.</returns>
    public EventSourceId GetEventSourceId() => AgentId.For(Purpose);

    /// <summary>
    /// Handles the command by appending the role and then exactly one assignment event.
    /// </summary>
    /// <returns>The role event followed by the assignment event.</returns>
    public IEnumerable<object> Handle()
    {
        object assignment = AgentAssignmentRules.Provider(ProviderId) is { } provider
            ? new AgentAssignedToProvider(provider)
            : AgentAssignmentRules.Pool(PoolId) is { } pool
                ? new AgentAssignedToPool(pool)
                : new AgentAssignmentCleared();

        return [new AgentRoleConfigured(Purpose, Name, Description, Tier, Harness, Effort), assignment];
    }
}

/// <summary>
/// Represents the validator for the <see cref="DefineAgent"/> command.
/// </summary>
public class DefineAgentValidator : CommandValidator<DefineAgent>
{
    readonly AgentAssignmentCompatibilityCheck _check;

    /// <summary>
    /// Initializes a new instance of the <see cref="DefineAgentValidator"/> class.
    /// </summary>
    /// <param name="readModels">The configured providers and pools.</param>
    /// <param name="compatibility">Checks provider capabilities against the agent purpose.</param>
    public DefineAgentValidator(IReadModels readModels, IAgentProviderCompatibility compatibility)
    {
        _check = new(readModels, compatibility);
        RuleFor(_ => _.Purpose).NotEqual(LanguageModelPurpose.NotSet).WithMessage("A purpose is required");
        RuleFor(_ => _.Name).NotEqual(AgentName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _)
            .Must(command => AgentAssignmentRules.IsExclusive(command.ProviderId, command.PoolId))
            .WithMessage("An agent runs on a provider or draws from a pool - not both");
        RuleFor(_ => _)
            .MustAsync((command, cancellationToken) => _check.IsCompatible(command.Purpose, command.ProviderId, command.PoolId, cancellationToken))
            .WithMessage("The selected provider or pool does not satisfy the capabilities required by this agent");
    }
}

/// <summary>
/// Shared assignment rules for the agent-defining commands, so the legacy and the current write paths
/// validate identically.
/// </summary>
internal static class AgentAssignmentRules
{
    /// <summary>
    /// Gets the provider when one is really given.
    /// </summary>
    /// <param name="providerId">The optional provider.</param>
    /// <returns>The provider, or <see langword="null"/> when absent or not set.</returns>
    internal static AIProviderId? Provider(AIProviderId? providerId) =>
        providerId is { } id && !id.Equals(AIProviderId.NotSet) ? id : null;

    /// <summary>
    /// Gets the pool when one is really given.
    /// </summary>
    /// <param name="poolId">The optional pool.</param>
    /// <returns>The pool, or <see langword="null"/> when absent or not set.</returns>
    internal static AIProviderPoolId? Pool(AIProviderPoolId? poolId) =>
        poolId is { } id && !id.Equals(AIProviderPoolId.NotSet) ? id : null;

    /// <summary>
    /// Checks that a provider is really given.
    /// </summary>
    /// <param name="providerId">The optional provider.</param>
    /// <returns><see langword="true"/> when given and not set.</returns>
    internal static bool IsSet(AIProviderId? providerId) => providerId is { } id && !id.Equals(AIProviderId.NotSet);

    /// <summary>
    /// Checks that a pool is really given.
    /// </summary>
    /// <param name="poolId">The optional pool.</param>
    /// <returns><see langword="true"/> when given and not set.</returns>
    internal static bool IsSet(AIProviderPoolId? poolId) => poolId is { } id && !id.Equals(AIProviderPoolId.NotSet);

    /// <summary>
    /// Checks that the provider and the pool are not both given.
    /// </summary>
    /// <param name="providerId">The optional provider.</param>
    /// <param name="poolId">The optional pool.</param>
    /// <returns><see langword="true"/> when at most one is given.</returns>
    internal static bool IsExclusive(AIProviderId? providerId, AIProviderPoolId? poolId) =>
        providerId?.Equals(AIProviderId.NotSet) != false || poolId?.Equals(AIProviderPoolId.NotSet) != false;
}

/// <summary>
/// Checks that a provider, or at least one member of a pool, satisfies an agent purpose.
/// </summary>
/// <param name="readModels">The configured providers and pools.</param>
/// <param name="compatibility">Checks provider capabilities against the agent purpose.</param>
internal sealed class AgentAssignmentCompatibilityCheck(IReadModels readModels, IAgentProviderCompatibility compatibility)
{
    /// <summary>
    /// Checks the assignment - a provider takes precedence, a missing assignment is compatible.
    /// </summary>
    /// <param name="purpose">The agent purpose.</param>
    /// <param name="providerId">The optional provider.</param>
    /// <param name="poolId">The optional pool.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns><see langword="true"/> when the assignment is compatible.</returns>
    internal async Task<bool> IsCompatible(LanguageModelPurpose purpose, AIProviderId? providerId, AIProviderPoolId? poolId, CancellationToken cancellationToken)
    {
        if (AgentAssignmentRules.IsSet(providerId)) return await ProviderSupports(purpose, providerId!);
        if (!AgentAssignmentRules.IsSet(poolId)) return true;
        return await PoolSupports(purpose, poolId!, cancellationToken);
    }

    async Task<bool> ProviderSupports(LanguageModelPurpose purpose, AIProviderId providerId)
    {
        var provider = await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
        return provider is null || compatibility.Supports(purpose, provider.Type);
    }

    async Task<bool> PoolSupports(LanguageModelPurpose purpose, AIProviderPoolId poolId, CancellationToken cancellationToken)
    {
        var pool = await readModels.GetInstanceById<AIProviderPool>((EventSourceId)poolId);
        if (pool?.Members is null) return true;

        foreach (var member in pool.Members)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (await ProviderIsKnownAndSupports(purpose, member.ProviderId)) return true;
        }

        return false;
    }

    async Task<bool> ProviderIsKnownAndSupports(LanguageModelPurpose purpose, AIProviderId providerId)
    {
        var provider = await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
        return provider is not null && compatibility.Supports(purpose, provider.Type);
    }
}

/// <summary>
/// Event raised when the role behind one of the Direct's own reasoning jobs has been defined. Where
/// the role runs is a separate fact: <see cref="AgentAssignedToProvider"/>,
/// <see cref="AgentAssignedToPool"/> or <see cref="AgentAssignmentCleared"/>.
/// </summary>
/// <remarks>
/// <paramref name="Purpose"/> restates the canonical source of <see cref="AgentId"/> - the composed
/// identity lowercases it, which is not reversible, so the value has to stay on the event. Replaces the
/// role half of the legacy <see cref="AgentConfigured"/>, which stays replayable.
/// </remarks>
/// <param name="Purpose">The reasoning job this role is for.</param>
/// <param name="Name">The role's display name.</param>
/// <param name="Description">What the role does, in a sentence.</param>
/// <param name="Tier">The capability tier this role asks for - the provider translates it into its concrete model.</param>
/// <param name="Harness">Historical per-agent preference retained for fallback when the selected provider has no harness selection.</param>
/// <param name="Effort">The reasoning effort the agent's AI provider runs completions at.</param>
[EventType]
public record AgentRoleConfigured(LanguageModelPurpose Purpose, AgentName Name, AgentDescription Description, ModelTier Tier, Harness Harness, Effort Effort);

/// <summary>
/// Event raised when an agent has been assigned to run on a single AI provider, replacing any earlier assignment.
/// </summary>
/// <param name="Provider">The AI provider the agent runs on.</param>
[EventType]
public record AgentAssignedToProvider(AIProviderId Provider);

/// <summary>
/// Event raised when an agent has been assigned to draw from an AI provider pool, replacing any earlier assignment.
/// </summary>
/// <param name="Pool">The AI provider pool the agent draws from.</param>
[EventType]
public record AgentAssignedToPool(AIProviderPoolId Pool);

/// <summary>
/// Event raised when an agent's explicit assignment has been cleared - it names neither a provider nor a pool.
/// </summary>
[EventType]
public record AgentAssignmentCleared;
