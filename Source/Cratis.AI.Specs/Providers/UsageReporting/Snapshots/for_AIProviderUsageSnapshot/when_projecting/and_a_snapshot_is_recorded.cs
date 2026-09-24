// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Providers.UsageReporting.RecordingSnapshot;

namespace Cratis.AI.Providers.UsageReporting.Snapshots.for_AIProviderUsageSnapshot.when_projecting;

public class and_a_snapshot_is_recorded : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();

    ReadModelScenario<AIProviderUsageSnapshot> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_provider).Events(
        new AIProviderUsageSnapshotRecorded(AIUsageReportAvailability.Available, 42_000, UsedLocalBurnFallback: false));

    [Fact] void should_carry_the_availability() => _scenario.Instance.Availability.ShouldEqual(AIUsageReportAvailability.Available);
    [Fact] void should_carry_the_consumed_tokens() => _scenario.Instance.ConsumedTokens.ShouldEqual(42_000);
    [Fact] void should_not_have_used_the_local_burn_fallback() => _scenario.Instance.UsedLocalBurnFallback.ShouldBeFalse();
    [Fact] void should_record_when_it_was_recorded() => _scenario.Instance.RecordedAt.ShouldNotBeNull();
}
