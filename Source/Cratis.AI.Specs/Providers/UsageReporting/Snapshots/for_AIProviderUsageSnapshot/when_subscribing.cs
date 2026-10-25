// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.UsageReporting.Snapshots.for_AIProviderUsageSnapshot;

public class when_subscribing : given.cached_readings
{
    AIProviderUsageSnapshot[] _result;

    async Task Because()
    {
        _clock.GetUtcNow().Returns(_recordedAt.AddDays(1));
        Subscribe();
        _result = await Next();
    }

    [Fact] void should_emit_the_cached_level_even_if_stale() => _result.Single().ConsumedTokens.ShouldEqual(42L);
    [Fact] void should_keep_the_recorded_time() => _result.Single().RecordedAt.ShouldEqual(_recordedAt);
    [Fact] void should_exclude_another_namespaces_provider() => _result.Select(reading => reading.Id).ShouldContainOnly(_visible);
    [Fact] void should_keep_the_availability() => _result.Single().Availability.ShouldEqual(AIUsageReportAvailability.Available);
    [Fact] void should_keep_the_fallback_flag() => _result.Single().UsedLocalBurnFallback.ShouldBeFalse();
}
