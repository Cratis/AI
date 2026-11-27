// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Agents.Defining.when_defining_agent;

public class and_a_pool_is_given_through_the_command : Specification
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();

    ManagementCommandScenario<DefineAgent> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        var provider = AIProviderId.New();
        _scenario.Given.ForEventSource(_pool).ReadModel(new AIProviderPool(_pool, "Test pool", [new(provider)]));
        _scenario.Given.ForEventSource(provider).ReadModel(new ConfiguredAIProvider(provider, AIProviderType.Anthropic, "test-key"));
    }

    async Task Because() => _result = await _scenario.Execute(new DefineAgent(
        "IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_append_the_role() => await _scenario.EventSequence.ShouldHaveAppendedEvent<AgentRoleConfigured>(@event => @event.Name == "Scout");
    [Fact] async Task should_append_the_pool_assignment() => await _scenario.EventSequence.ShouldHaveAppendedEvent<AgentAssignedToPool>(@event => @event.Pool == _pool);
}
