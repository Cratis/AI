// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;

namespace Cratis.AI.Providers.UsageReporting.RecordingSnapshot.when_recording_a_usage_snapshot;

public class and_the_local_burn_fallback_was_used : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    // Verify the retained legacy command until its major-release removal.
#pragma warning disable CS0618
    CommandScenario<RecordAIProviderUsageSnapshot> _scenario;
#pragma warning restore CS0618
    CommandResult _result;

    void Establish() => _scenario = new();

    // Exercise the obsolete command's replay-compatible shape.
#pragma warning disable CS0618
    async Task Because() => _result = await _scenario.Execute(
        new RecordAIProviderUsageSnapshot(_provider, AIUsageReportAvailability.NoCredentialConfigured, 500, UsedLocalBurnFallback: true));
#pragma warning restore CS0618

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    // Assert the retained legacy event contract.
#pragma warning disable CS0618
    [Fact]
    async Task should_append_the_snapshot_recorded_event_with_the_fallback_flagged() =>
        await _scenario.ShouldHaveAppendedEvent<RecordAIProviderUsageSnapshot, AIProviderUsageSnapshotRecorded>(
            (EventSourceId)_provider,
            @event => @event.Availability == AIUsageReportAvailability.NoCredentialConfigured
                && @event.ConsumedTokens == 500
                && @event.UsedLocalBurnFallback);
#pragma warning restore CS0618
}
