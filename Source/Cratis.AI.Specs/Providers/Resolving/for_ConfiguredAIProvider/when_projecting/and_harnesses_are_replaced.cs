// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Harnesses;
using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.SettingHarnesses;

namespace Cratis.AI.Providers.for_ConfiguredAIProvider.when_projecting;

public class and_harnesses_are_replaced : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    ReadModelScenario<ConfiguredAIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new AnthropicProviderAdded("Claude", "sk-ant-key", 4),
        new AIProviderHarnessesSet([Harness.Claude, Harness.Pi]),
        new AIProviderHarnessesSet([]));

    [Fact] void should_mark_the_selection_as_explicit() => _scenario.Instance.HasHarnessSelection.ShouldBeTrue();
    [Fact] void should_disable_harness_dispatch_with_an_empty_selection() => _scenario.Instance.SupportedHarnesses.ShouldBeEmpty();
}
