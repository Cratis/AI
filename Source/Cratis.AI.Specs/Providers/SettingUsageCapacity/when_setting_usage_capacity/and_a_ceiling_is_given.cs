// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingUsageCapacity.when_setting_usage_capacity;

public class and_a_ceiling_is_given : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    CommandScenario<SetAIProviderUsageCapacity> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetAIProviderUsageCapacity(_provider, 1_000_000));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_append_the_usage_capacity_set_event() =>
        await _scenario.ShouldHaveAppendedEvent<SetAIProviderUsageCapacity, AIProviderUsageCapacitySet>(
            (EventSourceId)_provider,
            @event => @event.UsageCapacity == new AIProviderUsageCapacity(1_000_000));
}
