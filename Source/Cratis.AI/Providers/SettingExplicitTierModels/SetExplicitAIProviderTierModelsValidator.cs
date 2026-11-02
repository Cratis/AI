// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingExplicitTierModels;

/// <summary>
/// Validates an intentional tier-table save with the same provider rule as the legacy command.
/// </summary>
public class SetExplicitAIProviderTierModelsValidator : CommandValidator<SetExplicitAIProviderTierModels>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SetExplicitAIProviderTierModelsValidator"/> class.
    /// </summary>
    public SetExplicitAIProviderTierModelsValidator()
    {
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
    }
}
