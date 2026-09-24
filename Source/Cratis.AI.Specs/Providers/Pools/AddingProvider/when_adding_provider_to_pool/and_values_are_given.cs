// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.AddingProvider.when_adding_provider_to_pool;

public class and_values_are_given : Specification
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _provider = AIProviderId.New();

    CommandScenario<AddProviderToPool> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new AddProviderToPool(_pool, _provider));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_provider_added_to_pool() => _scenario.EventSequence.ShouldHaveAppendedEvent<ProviderAddedToPool>(
        @event => @event.Provider == _provider);
}
