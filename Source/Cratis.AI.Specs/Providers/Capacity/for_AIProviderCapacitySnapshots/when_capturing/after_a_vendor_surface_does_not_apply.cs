// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_a_vendor_surface_does_not_apply : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish()
    {
        Configure(new(_provider, AIProviderType.Anthropic, new("key")) { UsageCapacity = new(1000) });
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(true);
        _reporter.Report(Arg.Any<ConfiguredAIProvider>(), Arg.Any<CancellationToken>()).Returns(AIProviderCapacityReport.NotApplicable("not this plan"));
        _levels.RefreshMany(Arg.Any<IReadOnlyCollection<AIProviderId>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<AIProviderId, ProviderUsageLevel> { [_provider] = new(AIUsageReportAvailability.NoCredentialConfigured, 250, true, new(1000)) });
        await _capacities.For(_provider);
    }
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_publish_the_selected_ceiling_fallback() => _snapshot.Source.ShouldEqual(AIProviderCapacitySource.ConfiguredCeiling);
    [Fact] void should_preserve_derived_remaining_allowance() => _snapshot.Windows.Single().Remaining.ShouldEqual(0.75);
    [Fact] void should_be_available() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Available);
}
