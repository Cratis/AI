// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Agents.Defining.when_defining_agent;

public class and_a_pool_is_given : Specification
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();

    IEnumerable<object> _events;

    void Because() => _events = new DefineAgent("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, AIProviderId.NotSet, _pool).Handle();

    [Fact]
    void should_record_the_role_then_the_pool() => _events.ShouldEqual(
    [
        new AgentRoleConfigured("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, Harness.Pi, Effort.High),
        new AgentAssignedToPool(_pool)
    ]);
}
