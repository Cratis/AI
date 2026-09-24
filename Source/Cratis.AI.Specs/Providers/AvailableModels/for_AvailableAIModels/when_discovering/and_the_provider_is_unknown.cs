// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AvailableAIModels.when_discovering;

public class and_the_provider_is_unknown : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    AIModelDiscoveryResult _result;

    void Establish() => ProviderIs(_provider, null);

    async Task Because() => _result = await _availableModels.Discover(_provider);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();

    [Fact] void should_answer_with_no_models() => _result.Models.ShouldBeEmpty();
}
