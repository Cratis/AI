// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.UsageReporting.Snapshots.for_AIProviderUsageSnapshot;

public class when_unsubscribing : given.cached_readings
{
    async Task Establish()
    {
        Subscribe();
        await Next();
        _readModels.ClearReceivedCalls();
    }

    void Because()
    {
        _subscription.Dispose();
        _cache.Record(_visible, new(AIUsageReportAvailability.Available, 100, false, null));
    }

    [Fact] void should_detach_from_the_cache() => _readModels.ReceivedCalls().ShouldBeEmpty();
    [Fact] void should_emit_no_more_readings() => _emissions.Reader.TryRead(out _).ShouldBeFalse();
}
