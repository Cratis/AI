// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Capacity;

namespace Cratis.AI.Usage.Recording.for_RecordAgentSessionUsageWithCapacity.given;

public class a_usage_boundary : Specification
{
    protected static readonly AIProviderId _provider = AIProviderId.New();
    protected static readonly AgentSessionId _session = AgentSessionId.New();
    protected static readonly DateTimeOffset _now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
    protected RecordAgentSessionUsageWithCapacity _command;
    protected IAIProviderCapacitySnapshots _snapshots;
    protected TimeProvider _clock;
    protected AIProviderCapacitySnapshot _snapshot;

    void Establish()
    {
        _clock = Substitute.For<TimeProvider>();
        _clock.GetUtcNow().Returns(_now);
        _snapshots = Substitute.For<IAIProviderCapacitySnapshots>();
        _snapshot = new(_provider, AIProviderCapacitySource.Subscription, AIProviderCapacitySnapshotState.Available, AIProviderCapacitySnapshotReason.None, _now, _now.AddMinutes(-1), [new(UsageWindowKind.Weekly, "weekly", 0.4, _now.AddDays(7))]);
        _snapshots.Capture(_provider).Returns(_snapshot);
        _command = new(_session, new("triage"), new("sonnet"), new("triage"), _provider, null, new(120), new(45), new(10), new(0.02m), new(3.5m), new(1024), new(2500));
    }
}
