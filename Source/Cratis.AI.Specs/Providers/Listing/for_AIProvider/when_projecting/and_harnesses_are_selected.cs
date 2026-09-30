// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Harnesses;
using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.SettingHarnesses;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

public class and_harnesses_are_selected : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new AnthropicProviderAdded("Claude", "sk-ant-key", 4),
        new AIProviderHarnessesSet([Harness.Claude, Harness.Pi]),
        new AIProviderHarnessesSet([Harness.Pi]));

    [Fact] void should_mark_the_selection_as_explicit() => _scenario.Instance.HasHarnessSelection.ShouldBeTrue();
    [Fact] void should_show_the_latest_selection() => _scenario.Instance.SupportedHarnesses!.ShouldContainOnly(Harness.Pi);
}
