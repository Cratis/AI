// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Defining.when_defining_agent;

public class and_the_provider_is_unknown : Specification
{
    readonly ManagementCommandScenario<DefineAgent> _scenario = new();
    CommandResult _result;

    async Task Because() => _result = await _scenario.Execute(new DefineAgent(
        "IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, AIProviderId.New()));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_identify_the_unknown_provider() => _result.ShouldHaveValidationErrorFor("The selected provider is unknown");
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.ShouldBeEmpty();
}
