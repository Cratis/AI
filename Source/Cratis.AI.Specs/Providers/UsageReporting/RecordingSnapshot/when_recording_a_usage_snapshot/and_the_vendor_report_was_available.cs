// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;

namespace Cratis.AI.Providers.UsageReporting.RecordingSnapshot.when_recording_a_usage_snapshot;

public class and_the_vendor_report_was_available : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    CommandScenario<RecordAIProviderUsageSnapshot> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new RecordAIProviderUsageSnapshot(_provider, AIUsageReportAvailability.Available, 12_345, UsedLocalBurnFallback: false));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_append_the_snapshot_recorded_event() =>
        await _scenario.ShouldHaveAppendedEvent<RecordAIProviderUsageSnapshot, AIProviderUsageSnapshotRecorded>(
            (EventSourceId)_provider,
            @event => @event.Availability == AIUsageReportAvailability.Available
                && @event.ConsumedTokens == 12_345
                && !@event.UsedLocalBurnFallback);
}
