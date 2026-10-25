// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

public class and_no_harness_selection_exists : Specification
{
    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(AIProviderId.New()).Events(
        new AnthropicProviderAdded("Claude", "sk-ant-key", 4));

    [Fact] void should_leave_the_selection_unset() => _scenario.Instance.HasHarnessSelection.ShouldBeFalse();
}
