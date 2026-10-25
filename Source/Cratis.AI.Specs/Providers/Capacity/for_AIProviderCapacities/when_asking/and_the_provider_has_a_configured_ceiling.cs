// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacities.when_asking;

/// <summary>
/// An API key no vendor surface reports on is judged by its hand-set ceiling.
/// </summary>
public class and_the_provider_has_a_configured_ceiling : given.all_dependencies
{
    AIProviderCapacity _capacity;

    void Establish()
    {
        ProviderIs(new ConfiguredAIProvider(_provider, AIProviderType.OpenAI, "sk-test") { UsageCapacity = 1000 });
        ConsumedTokensAre(750, 1000);
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(false);
    }

    async Task Because() => _capacity = await _capacities.For(_provider);

    [Fact] void should_report_the_configured_ceiling() => _capacity.Source.ShouldEqual(AIProviderCapacitySource.ConfiguredCeiling);
    [Fact] void should_report_the_share_left() => _capacity.Headroom.ShouldEqual(0.25);
    [Fact] void should_report_one_configured_window() => _capacity.Windows.Single().Name.ShouldEqual(AIProviderCapacities.ConfiguredCapacity);
}
