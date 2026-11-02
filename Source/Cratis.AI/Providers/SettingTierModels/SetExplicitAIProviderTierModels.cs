// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingTierModels;

/// <summary>
/// Deliberately saves a provider's complete tier table, including unchanged selections.
/// </summary>
/// <param name="Provider">The provider whose event stream receives the table.</param>
/// <param name="Models">The complete operator-selected table.</param>
[Command]
public record SetExplicitAIProviderTierModels(AIProviderId Provider, TierModels Models)
{
    /// <summary>
    /// Records the compatibility mapping and its explicit origin in one ordered command append.
    /// </summary>
    /// <returns>The mapping followed by its provenance.</returns>
    public IEnumerable<object> Handle() =>
    [
        new AIProviderTierModelsSet(Models),
        new AIProviderTierModelsProvenanceSet(Models, TierModelMappingSource.Explicit)
    ];
}
