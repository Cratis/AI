// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingTierModels.when_setting_tier_models;

public class and_no_provider_is_given : Specification
{
    CommandScenario<SetAIProviderTierModels> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetAIProviderTierModels(AIProviderId.NotSet, TierModels.NotSet));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
}
