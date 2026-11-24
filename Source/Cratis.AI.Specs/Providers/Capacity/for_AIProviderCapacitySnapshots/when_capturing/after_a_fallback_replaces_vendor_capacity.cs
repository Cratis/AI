// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_a_fallback_replaces_vendor_capacity : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish()
    {
        Configure(new(_provider, AIProviderType.Anthropic, new("account-one")));
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(true);
        _reporter.Report(Arg.Any<ConfiguredAIProvider>(), Arg.Any<CancellationToken>()).Returns(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "old vendor", 0.8, null)]));
        await _capacities.For(_provider);
        Configure(new(_provider, AIProviderType.OpenAI, new("account-two")));
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(false);
        _clock.Now += TimeSpan.FromMinutes(1);
        await _capacities.For(_provider);
    }
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_publish_the_selected_fallback_not_old_vendor_data() => _snapshot.Source.ShouldEqual(AIProviderCapacitySource.Unmetered);
    [Fact] void should_be_explicitly_available_without_a_measured_limit() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Available);
    [Fact] void should_not_retain_vendor_windows() => _snapshot.Windows.ShouldBeEmpty();
    [Fact] void should_preserve_fallback_calculation_time() => _snapshot.ObservedAt.ShouldEqual(_clock.Now);
}
