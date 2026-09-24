// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.SettingUsageCapacity;
using CratisAIAdding = Cratis.AI.Providers.Adding;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

public class and_a_usage_capacity_is_set : Specification
{
    static readonly AIProviderId _id = AIProviderId.New();

    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(
                new CratisAIAdding.AnthropicProviderAdded("Primary", "sk-ant-test", 5),
                new AIProviderUsageCapacitySet(1_000_000));

    [Fact] void should_hold_the_usage_capacity() => _scenario.Instance.UsageCapacity.ShouldEqual(new AIProviderUsageCapacity(1_000_000));
}
