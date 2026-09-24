// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Agents.Configuring;

/// <summary>
/// Command for naming the role behind one of the Direct's own reasoning jobs, and optionally
/// giving it its own provider or provider pool - so a job that reasons about something high-stakes
/// (merge classification) can run a stronger model, a different vendor, or draw from a pool of
/// providers, rather than every job reasoning the same way. Provider and pool are mutually
/// exclusive - the validator refuses both, and an agent with neither does not run.
/// </summary>
/// <param name="Purpose">The reasoning job this role is for.</param>
/// <param name="Name">The role's display name.</param>
/// <param name="Description">What the role does, in a sentence.</param>
/// <param name="Tier">The capability tier this role asks for (#865) - each provider translates the tier into the concrete model it offers for it, so moving an agent between vendors keeps meaning the same thing.</param>
/// <param name="ProviderId">The AI provider this role runs on - <see langword="null"/> leaves it unable to run until one is set. Mutually exclusive with <paramref name="PoolId"/>.</param>
/// <param name="PoolId">The AI provider pool this role draws from - dispatch picks the member with the least tokens burnt over the trailing week. Mutually exclusive with <paramref name="ProviderId"/>.</param>
/// <param name="Harness">The CLI harness the agent's job invocations run under - only meaningful for the <see cref="AgentInvocationMode.Job"/> agent; chat agents never touch a harness.</param>
/// <param name="Effort">The reasoning effort the agent's AI provider runs completions at - each <c>IAIProviderClient</c> translates it to its own vendor's mechanism.</param>
[Command]
public record ConfigureAgent(LanguageModelPurpose Purpose, AgentName Name, AgentDescription Description, ModelTier Tier, AIProviderId? ProviderId = null, AIProviderPoolId? PoolId = null, Harness Harness = Harness.Pi, Effort Effort = Effort.High) : ICanProvideEventSourceId
{
    /// <summary>
    /// Gets the role's identity - one per purpose.
    /// </summary>
    /// <returns>The event source id.</returns>
    public EventSourceId GetEventSourceId() => AgentId.For(Purpose);

    /// <summary>
    /// Handles the command by appending an <see cref="AgentConfigured"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AgentConfigured Handle() => new(Purpose, Name, Description, Tier, ProviderId, PoolId, Harness, Effort);
}

/// <summary>
/// Represents the validator for the <see cref="ConfigureAgent"/> command.
/// </summary>
public class ConfigureAgentValidator : CommandValidator<ConfigureAgent>
{
    readonly IReadModels _readModels;
    readonly IAgentProviderCompatibility _compatibility;

    /// <summary>
    /// Initializes a new instance of the <see cref="ConfigureAgentValidator"/> class.
    /// </summary>
    /// <param name="readModels">The configured providers and pools.</param>
    /// <param name="compatibility">Checks provider capabilities against the agent purpose.</param>
    public ConfigureAgentValidator(IReadModels readModels, IAgentProviderCompatibility compatibility)
    {
        _readModels = readModels;
        _compatibility = compatibility;
        RuleFor(_ => _.Purpose).NotEqual(LanguageModelPurpose.NotSet).WithMessage("A purpose is required");
        RuleFor(_ => _.Name).NotEqual(AgentName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _)
            .Must(command => command.ProviderId?.Equals(AIProviderId.NotSet) != false ||
                             command.PoolId?.Equals(AIProviderPoolId.NotSet) != false)
            .WithMessage("An agent runs on a provider or draws from a pool - not both");
        RuleFor(_ => _)
            .MustAsync(async (command, cancellationToken) => await AssignmentIsCompatible(command, cancellationToken))
            .WithMessage("The selected provider or pool does not satisfy the capabilities required by this agent");
    }

    async Task<bool> AssignmentIsCompatible(ConfigureAgent command, CancellationToken cancellationToken)
    {
        if (command.ProviderId is { } providerId && !providerId.Equals(AIProviderId.NotSet))
        {
            var provider = await _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
            return provider is null || _compatibility.Supports(command.Purpose, provider.Type);
        }

        if (command.PoolId is not { } poolId || poolId.Equals(AIProviderPoolId.NotSet)) return true;

        var pool = await _readModels.GetInstanceById<AIProviderPool>((EventSourceId)poolId);
        if (pool?.Members is null) return true;

        foreach (var member in pool.Members)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var provider = await _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)member.ProviderId);
            if (provider is not null && _compatibility.Supports(command.Purpose, provider.Type)) return true;
        }

        return false;
    }
}

/// <summary>
/// Event raised when the role behind one of the Direct's own reasoning jobs has been named.
/// </summary>
/// <remarks>
/// <paramref name="Purpose"/> restates the canonical source of <see cref="AgentId"/> rather than
/// being reconstructible from the event context - the composed identity lowercases it, which is not
/// reversible, so the value has to stay on the event. See
/// <see href="https://github.com/Cratis/Stagehand/issues/261"/>.
/// <para>
/// <paramref name="Tier"/> replaced the concrete <c>Model</c> this event used
/// to carry (#865) - the provider's own tier mapping translates it, so the same agent means the same
/// thing on every vendor. Evolved in place rather than by generation, per this repository's event
/// evolution policy: production was repaired at rollout per <c>.agents/PROJECT.md</c>, with stored
/// events rewritten to carry <see cref="ModelTier.Balanced"/> - the tier agents configured before
/// tiers existed map to.
/// </para>
/// </remarks>
/// <param name="Purpose">The reasoning job this role is for.</param>
/// <param name="Name">The role's display name.</param>
/// <param name="Description">What the role does, in a sentence.</param>
/// <param name="Tier">The capability tier this role asks for - the provider translates it into its concrete model.</param>
/// <param name="ProviderId">The AI provider this role runs on - <see langword="null"/> leaves it unable to run until one is set. Mutually exclusive with <paramref name="PoolId"/>.</param>
/// <param name="PoolId">The AI provider pool this role draws from - <see langword="null"/> when the role runs on a single provider or the global fallback. Mutually exclusive with <paramref name="ProviderId"/>.</param>
/// <param name="Harness">The CLI harness the agent's job invocations run under - only meaningful for the job-mode agent.</param>
/// <param name="Effort">The reasoning effort the agent's AI provider runs completions at.</param>
[EventType]
public record AgentConfigured(LanguageModelPurpose Purpose, AgentName Name, AgentDescription Description, ModelTier Tier, AIProviderId? ProviderId, AIProviderPoolId? PoolId, Harness Harness, Effort Effort);
