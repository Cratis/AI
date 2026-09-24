// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;

namespace Cratis.AI.Providers.UsageReporting.RecordingSnapshot.when_recording_a_usage_snapshot;

public class and_the_local_burn_fallback_was_used : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    CommandScenario<RecordAIProviderUsageSnapshot> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new RecordAIProviderUsageSnapshot(_provider, AIUsageReportAvailability.NoCredentialConfigured, 500, UsedLocalBurnFallback: true));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    async Task should_append_the_snapshot_recorded_event_with_the_fallback_flagged() =>
        await _scenario.ShouldHaveAppendedEvent<RecordAIProviderUsageSnapshot, AIProviderUsageSnapshotRecorded>(
            (EventSourceId)_provider,
            @event => @event.Availability == AIUsageReportAvailability.NoCredentialConfigured
                && @event.ConsumedTokens == 500
                && @event.UsedLocalBurnFallback);
}
