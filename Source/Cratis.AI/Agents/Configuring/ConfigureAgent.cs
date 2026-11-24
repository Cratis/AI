// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Defining;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.Arc.Authorization;

namespace Cratis.AI.Agents.Configuring;

/// <summary>
/// Command for naming the role behind one of the Direct's own reasoning jobs, and optionally
/// giving it its own provider or provider pool - so a job that reasons about something high-stakes
/// (merge classification) can run a stronger model, a different vendor, or draw from a pool of
/// providers, rather than every job reasoning the same way. Provider and pool are mutually
/// exclusive - the validator refuses both, and an agent with neither has no explicit assignment.
/// </summary>
/// <remarks>
/// This is the legacy write path: it still records the combined <see cref="AgentConfigured"/> event,
/// kept for compatibility and to be removed in a later major release. New callers use
/// <see cref="DefineAgent"/>, which records the role and the assignment as separate events.
/// </remarks>
/// <param name="Purpose">The reasoning job this role is for.</param>
/// <param name="Name">The role's display name.</param>
/// <param name="Description">What the role does, in a sentence.</param>
/// <param name="Tier">The capability tier this role asks for (#865) - each provider translates the tier into the concrete model it offers for it, so moving an agent between vendors keeps meaning the same thing.</param>
/// <param name="ProviderId">The AI provider this role runs on - <see langword="null"/> leaves it unable to run until one is set. Mutually exclusive with <paramref name="PoolId"/>.</param>
/// <param name="PoolId">The AI provider pool this role draws from - dispatch picks the member with the least tokens burnt over the trailing week. Mutually exclusive with <paramref name="ProviderId"/>.</param>
/// <param name="Harness">Deprecated per-agent harness preference, retained for older callers and fallback when a provider has no selection. Configure provider harnesses instead.</param>
/// <param name="Effort">The reasoning effort the agent's AI provider runs completions at - each <c>IAIProviderClient</c> translates it to its own vendor's mechanism.</param>
[Command]
[Authorize(Policy = AIManagementPolicy.Name)]
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
    readonly AgentAssignmentCompatibilityCheck _check;

    /// <summary>
    /// Initializes a new instance of the <see cref="ConfigureAgentValidator"/> class.
    /// </summary>
    /// <param name="readModels">The configured providers and pools.</param>
    /// <param name="compatibility">Checks provider capabilities against the agent purpose.</param>
    public ConfigureAgentValidator(IReadModels readModels, IAgentProviderCompatibility compatibility)
    {
        _check = new(readModels, compatibility);
        RuleFor(_ => _.Purpose).NotEqual(LanguageModelPurpose.NotSet).WithMessage("A purpose is required");
        RuleFor(_ => _.Name).NotEqual(AgentName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _)
            .Must(command => AgentAssignmentRules.IsExclusive(command.ProviderId, command.PoolId))
            .WithMessage("An agent runs on a provider or draws from a pool - not both");
        RuleFor(_ => _)
            .CustomAsync(async (command, context, cancellationToken) =>
            {
                var error = await _check.ValidationError(command.Purpose, command.ProviderId, command.PoolId, cancellationToken);
                if (error is not null) context.AddFailure(error);
            });
    }
}

/// <summary>
/// Event raised when the role behind one of the Direct's own reasoning jobs has been named.
/// </summary>
/// <remarks>
/// Legacy combined role-and-assignment contract: still written by <see cref="ConfigureAgent"/> and always
/// replayed, but new writers use <see cref="AgentRoleConfigured"/> and the assignment events.
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
/// <param name="Harness">Historical per-agent preference retained for replay and fallback when the selected provider has no harness selection.</param>
/// <param name="Effort">The reasoning effort the agent's AI provider runs completions at.</param>
[EventType]
public record AgentConfigured(LanguageModelPurpose Purpose, AgentName Name, AgentDescription Description, ModelTier Tier, AIProviderId? ProviderId, AIProviderPoolId? PoolId, Harness Harness, Effort Effort);
