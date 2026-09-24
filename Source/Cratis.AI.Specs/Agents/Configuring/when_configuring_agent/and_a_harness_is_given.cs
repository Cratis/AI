// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Configuring.when_configuring_agent;

public class and_a_harness_is_given : Specification
{
    CommandScenario<ConfigureAgent> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ConfigureAgent(
        "WorkExecution", "Wright", "Carries out scheduled units of work.", ModelTier.Balanced, Harness: Harness.Pi));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_agent_configured_with_the_harness() => _scenario.EventSequence.ShouldHaveAppendedEvent<AgentConfigured>(
        @event => @event.Purpose == new LanguageModelPurpose("WorkExecution") && @event.Harness == Harness.Pi);
}
