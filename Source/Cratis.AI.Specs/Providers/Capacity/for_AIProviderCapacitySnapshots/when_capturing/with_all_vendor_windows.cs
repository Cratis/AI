// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Json;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class with_all_vendor_windows : given.a_snapshot_cache
{
    readonly List<UsageWindow> _windows = [
        new(UsageWindowKind.FiveHour, "5-hour", 0.2, _start.AddHours(5)),
        new(UsageWindowKind.Daily, "daily", 0.4, _start.AddDays(1)),
        new(UsageWindowKind.Weekly, "weekly", 0.6, _start.AddDays(7)),
        new(UsageWindowKind.Weekly, "sonnet weekly", 1.2, null),
        new(UsageWindowKind.Monthly, "monthly", -0.1, _start.AddMonths(1)),
        new(UsageWindowKind.Other, "configured", 0.5, null)];
    AIProviderCapacitySnapshot _snapshot;
    AIProviderCapacitySnapshot _roundTrip;

    async Task Establish()
    {
        await Observe(AIProviderCapacityReport.Subscription(_windows));
        _clock.Now += TimeSpan.FromMinutes(1);
    }

    void Because()
    {
        _snapshot = _snapshots.Capture(_provider);
        var options = new JsonSerializerOptions { Converters = { new ConceptAsJsonConverterFactory() } };
        _roundTrip = JsonSerializer.Deserialize<AIProviderCapacitySnapshot>(JsonSerializer.Serialize(_snapshot, options), options)!;
        _windows.Clear();
    }

    [Fact] void should_keep_every_distinct_label_in_order() => _snapshot.Windows.Select(window => window.Name).ShouldEqual(new[] { "5-hour", "daily", "weekly", "sonnet weekly", "monthly", "configured" });
    [Fact] void should_clamp_each_remaining_fraction() => _snapshot.Windows.Select(window => window.Remaining).ShouldEqual(new[] { 0.8, 0.6, 0.4, 0.0, 1.0, 0.5 });
    [Fact] void should_preserve_the_original_observation_time() => _snapshot.ObservedAt.ShouldEqual(_start);
    [Fact] void should_use_the_boundary_time() => _snapshot.CapturedAt.ShouldEqual(_clock.Now);
    [Fact] void should_preserve_the_reset_time() => _snapshot.Windows[0].ResetsAt.ShouldEqual(_start.AddHours(5));
    [Fact] void should_represent_an_unknown_reset_without_null() => _snapshot.Windows[3].ResetsAt.ShouldEqual(AIProviderCapacitySnapshot.UnknownTime);
    [Fact] void should_copy_the_provider_identity() => _roundTrip.Provider.ShouldEqual(_provider);
    [Fact] void should_round_trip_all_windows() => _roundTrip.Windows.ShouldEqual(_snapshot.Windows);
    [Fact] void should_not_query_the_vendor_during_capture() => _reads.ShouldEqual(1);
}
