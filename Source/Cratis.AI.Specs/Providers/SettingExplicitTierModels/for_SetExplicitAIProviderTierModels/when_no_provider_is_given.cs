// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingExplicitTierModels.for_SetExplicitAIProviderTierModels;

public class when_no_provider_is_given : Specification
{
    CommandScenario<SetExplicitAIProviderTierModels> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();
    async Task Because() => _result = await _scenario.Execute(new SetExplicitAIProviderTierModels(AIProviderId.NotSet, TierModels.NotSet));

    [Fact] void should_reject_the_save() => _result.ShouldNotBeSuccessful();
}
