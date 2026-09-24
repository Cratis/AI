// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Configuring.when_configuring_agent;

public class and_values_are_given : Specification
{
    CommandScenario<ConfigureAgent> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ConfigureAgent(
        "AutoMergeClassification", "Gatekeeper", "Reads a diff and judges whether it is safe to merge on its own.", ModelTier.Powerful));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_agent_configured() => _scenario.EventSequence.ShouldHaveAppendedEvent<AgentConfigured>(
        @event =>
            @event.Purpose == new LanguageModelPurpose("AutoMergeClassification") &&
            @event.Name == new AgentName("Gatekeeper") &&
            @event.Tier == ModelTier.Powerful);
}
