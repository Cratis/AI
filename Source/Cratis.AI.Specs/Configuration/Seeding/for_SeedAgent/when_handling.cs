// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Defining;
using Cratis.AI.Providers;
using Cratis.Monads;

namespace Cratis.AI.Configuration.Seeding.for_SeedAgent;

public class when_handling : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();

    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _forNone;
    Result<IEnumerable<object>, Cratis.Arc.Validation.ValidationResult> _forExisting;

    void Because()
    {
        var command = new SeedAgent("Greeting", "Greeter", "Answers the greeting.", ModelTier.Fast, _providerId);
        _forNone = command.Handle(null);
        _forExisting = command.Handle(new SeededAgentPresence(AgentId.For("Greeting"), new AgentName("Greeter")));
    }

    [Fact]
    void should_define_the_agent_when_the_purpose_has_none()
    {
        _forNone.TryGetResult(out var events);
        events.ShouldEqual(
        [
            new AgentRoleConfigured("Greeting", "Greeter", "Answers the greeting.", ModelTier.Fast, Harness.Pi, Effort.High),
            new AgentAssignedToProvider(_providerId)
        ]);
    }

    [Fact]
    void should_append_nothing_when_the_purpose_has_an_agent()
    {
        _forExisting.TryGetResult(out var events);
        events.ShouldBeEmpty();
    }
}
