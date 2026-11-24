// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Agents.Defining.when_defining_agent;

public class and_a_pool_is_given_through_the_command : Specification
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();

    ManagementCommandScenario<DefineAgent> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new DefineAgent(
        "IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_the_role() => _scenario.EventSequence.ShouldHaveAppendedEvent<AgentRoleConfigured>(@event => @event.Name == "Scout");
    [Fact] void should_append_the_pool_assignment() => _scenario.EventSequence.ShouldHaveAppendedEvent<AgentAssignedToPool>(@event => @event.Pool == _pool);
}
