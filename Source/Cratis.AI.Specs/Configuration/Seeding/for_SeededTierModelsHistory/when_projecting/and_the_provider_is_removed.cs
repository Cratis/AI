// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Removing;
using Cratis.AI.Providers.SettingTierModels;

namespace Cratis.AI.Configuration.Seeding.for_SeededTierModelsHistory.when_projecting;

public class and_the_provider_is_removed : Specification
{
    static readonly AIProviderId _id = AIProviderId.New();

    ReadModelScenario<SeededTierModelsHistory> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new AIProviderTierModelsSet(TierModels.NotSet),
                new AIProviderRemoved());

    [Fact] void should_have_no_history() => _scenario.Instance.ShouldBeNull();
}
