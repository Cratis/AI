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
/// one decides on whether the table was <em>ever</em> set (a passive read model over the provider's own
/// stream, so it cannot be behind), not on its current value: an administrator who sets every tier to
/// <c>NotSet</c> to restore the vendor defaults has made a choice the next start must keep. A run that
/// stopped after creating the provider can still finish the job later, because nothing was set yet.
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
    /// <param name="history">Whether the tier models were ever set - <see langword="null"/> when they never were.</param>
    /// <returns>The events - none when the tier models were ever set.</returns>
    public Result<IEnumerable<object>, ValidationResult> Handle(SeededTierModelsHistory? history)
    {
        if (history is not null)
        {
            return Result<IEnumerable<object>, ValidationResult>.Success([]);
        }

        return Result<IEnumerable<object>, ValidationResult>.Success([new AIProviderTierModelsSet(Models)]);
    }
}

/// <summary>
/// Records that a provider's tier models were set at least once, whatever they were set to - read from
/// the provider's own stream, so it cannot be behind the way a list read model can.
/// </summary>
/// <param name="Id">The provider's identity.</param>
[ReadModel]
[Authorize(Policy = AIManagementPolicy.Name)]
[Passive]
[FromEvent<AIProviderTierModelsSet>]
public record SeededTierModelsHistory(AIProviderId Id);

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
