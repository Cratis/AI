// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingConcurrency.when_setting_concurrency;

public class and_a_limit_is_given : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    CommandScenario<SetAIProviderConcurrency> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new SetAIProviderConcurrency(_provider, 3));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_append_the_concurrency_set_event() =>
        await _scenario.ShouldHaveAppendedEvent<SetAIProviderConcurrency, AIProviderConcurrencySet>(
            (EventSourceId)_provider,
            @event => @event.MaxConcurrentJobs == new MaxConcurrentJobs(3));
}
