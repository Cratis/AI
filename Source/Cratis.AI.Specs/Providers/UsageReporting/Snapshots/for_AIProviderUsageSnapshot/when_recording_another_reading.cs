// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.UsageReporting.Snapshots.for_AIProviderUsageSnapshot;

public class when_recording_another_reading : given.cached_readings
{
    AIProviderUsageSnapshot[] _result;

    async Task Establish()
    {
        Subscribe();
        await Next();
        _clock.GetUtcNow().Returns(_recordedAt.AddMinutes(1));
    }

    async Task Because()
    {
        _cache.Record(_visible, new(AIUsageReportAvailability.Unreachable, 123, true, null));
        _result = await Next();
    }

    [Fact] void should_emit_the_new_level() => _result.Single().ConsumedTokens.ShouldEqual(123L);
    [Fact] void should_emit_the_new_recorded_time() => _result.Single().RecordedAt.ShouldEqual(_recordedAt.AddMinutes(1));
    [Fact] void should_still_exclude_another_namespaces_provider() => _result.Select(reading => reading.Id).ShouldContainOnly(_visible);
    [Fact] void should_emit_the_new_availability() => _result.Single().Availability.ShouldEqual(AIUsageReportAvailability.Unreachable);
    [Fact] void should_emit_the_new_fallback_flag() => _result.Single().UsedLocalBurnFallback.ShouldBeTrue();
}
