// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingTierModels;

/// <summary>
/// Command for setting which concrete models a provider offers for each of Direct's capability
/// tiers (#865) - the translation table every tier-asking agent on that provider resolves through.
/// </summary>
/// <remarks>
/// Deliberately whole-table rather than per-tier: the interesting question when configuring is
/// "what does the ladder look like on this vendor", and answering it one tier at a time hides the
/// overlaps (two tiers on the same model) and gaps (a tier with nothing behind it) that only show
/// side by side. A tier left unset falls back to the vendor default, so the table can be partial.
/// </remarks>
/// <param name="Provider">The provider to set the mapping on - the identity the event's stream is bound to.</param>
/// <param name="Models">The mapping - every tier <c>NotSet</c> means "back to the vendor defaults".</param>
[Command]
public record SetAIProviderTierModels(AIProviderId Provider, TierModels Models)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderTierModelsSet"/> event to the provider's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public AIProviderTierModelsSet Handle() => new(Models);
}

/// <summary>
/// Represents the validator for the <see cref="SetAIProviderTierModels"/> command.
/// </summary>
public class SetAIProviderTierModelsValidator : CommandValidator<SetAIProviderTierModels>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SetAIProviderTierModelsValidator"/> class.
    /// </summary>
    public SetAIProviderTierModelsValidator()
    {
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
    }
}

/// <summary>
/// Event raised when the models a provider offers for Direct's capability tiers have been set -
/// the whole table at once, unset tiers meaning the vendor default from then on.
/// </summary>
/// <param name="Models">The mapping - every tier <c>NotSet</c> means the vendor defaults.</param>
[EventType]
public record AIProviderTierModelsSet(TierModels Models);
