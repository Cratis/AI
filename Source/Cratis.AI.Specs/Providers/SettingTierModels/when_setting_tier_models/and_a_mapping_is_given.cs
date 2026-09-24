// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingTierModels.when_setting_tier_models;

public class and_a_mapping_is_given : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    CommandScenario<SetAIProviderTierModels> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetAIProviderTierModels(
        _provider,
        new TierModels(
            Fast: new ModelName("vendor-fast"),
            Balanced: new ModelName("vendor-balanced"),
            Powerful: new ModelName("vendor-powerful"),
            Premier: ModelName.NotSet)));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_append_the_tier_models_set_event() =>
        await _scenario.ShouldHaveAppendedEvent<SetAIProviderTierModels, AIProviderTierModelsSet>(
            (EventSourceId)_provider,
            @event => @event.Models.Fast == new ModelName("vendor-fast")
                   && @event.Models.Balanced == new ModelName("vendor-balanced")
                   && @event.Models.Powerful == new ModelName("vendor-powerful")
                   && @event.Models.Premier == ModelName.NotSet);
}
