// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.Arc.Authorization;
using Cratis.Monads;

namespace Cratis.AI.Configuration.Seeding;

/// <summary>
/// Command for giving a seeded provider its tier models, only while it has none.
/// </summary>
/// <remarks>
/// <see cref="SetAIProviderTierModels"/> replaces the whole table, which is right for an administrator
/// and wrong for a seed that runs on every start: it would put back what an administrator changed. This
/// one reads the provider from its own stream (a passive read model, so it cannot be behind) and
/// appends nothing once any tier is set - which also lets a run that stopped after creating the
/// provider finish the job later.
/// </remarks>
/// <param name="Provider">The provider to set the models on.</param>
/// <param name="Models">The models to set.</param>
[Command]
[Authorize(Policy = AIManagementPolicy.Name)]
public record SeedAIProviderTierModels(AIProviderId Provider, TierModels Models)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderTierModelsSet"/> event when the provider has no tier models yet.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <returns>The events - none when the provider already has tier models - or a validation error when the provider is not configured.</returns>
    public Result<IEnumerable<object>, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is null)
        {
            return ValidationResult.Error("The provider is not configured");
        }

        if (!current.TierModels.Equals(TierModels.NotSet))
        {
            return Result<IEnumerable<object>, ValidationResult>.Success([]);
        }

        return Result<IEnumerable<object>, ValidationResult>.Success([new AIProviderTierModelsSet(Models)]);
    }
}

/// <summary>
/// Represents the validator for the <see cref="SeedAIProviderTierModels"/> command.
/// </summary>
public class SeedAIProviderTierModelsValidator : CommandValidator<SeedAIProviderTierModels>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SeedAIProviderTierModelsValidator"/> class.
    /// </summary>
    public SeedAIProviderTierModelsValidator()
    {
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
    }
}
