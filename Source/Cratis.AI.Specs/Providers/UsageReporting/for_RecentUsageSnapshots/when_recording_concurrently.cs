// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reactive.Linq;

namespace Cratis.AI.Providers.UsageReporting.for_RecentUsageSnapshots;

public class when_recording_concurrently : Specification
{
    readonly RecentUsageSnapshots _cache = new(TimeProvider.System);
    readonly AIProviderId[] _providers = Enumerable.Range(0, 32).Select(_ => AIProviderId.New()).ToArray();
    readonly List<int> _snapshotSizes = [];
    IDisposable _subscription;

    void Establish() => _subscription = _cache.Observe().Subscribe(snapshots => _snapshotSizes.Add(snapshots.Count()));

    void Because() => Parallel.ForEach(_providers, provider =>
        _cache.Record(provider, new(AIUsageReportAvailability.Available, 123, false, null)));

    [Fact] void should_publish_each_update_in_order() => _snapshotSizes.ShouldEqual(Enumerable.Range(0, _providers.Length + 1));
    [Fact] void should_retain_every_provider_reading() => _providers.All(provider => _cache.Get(provider, TimeSpan.MaxValue)?.ConsumedTokens == 123).ShouldBeTrue();

    void Destroy()
    {
        _subscription.Dispose();
        _cache.Dispose();
    }
}
