// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Defining.when_defining_agent;

public class and_a_provider_is_given : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    IEnumerable<object> _events;

    void Because() => _events = new DefineAgent("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, _provider, null, Harness.Claude, Effort.Low).Handle();

    [Fact]
    void should_record_the_role_then_the_provider() => _events.ShouldEqual(
    [
        new AgentRoleConfigured("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, Harness.Claude, Effort.Low),
        new AgentAssignedToProvider(_provider)
    ]);
}
