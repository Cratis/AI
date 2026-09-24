// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Agents.Configuring.when_configuring_agent;

public class and_a_pool_is_given : Specification
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();

    CommandScenario<ConfigureAgent> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ConfigureAgent(
        "IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_agent_configured_with_the_pool() => _scenario.EventSequence.ShouldHaveAppendedEvent<AgentConfigured>(
        @event => @event.PoolId == _pool && @event.ProviderId == null);
}
