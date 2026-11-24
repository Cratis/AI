// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Usage.Recording.for_RecordAgentSessionUsageWithCapacity.when_handling;

public class with_reported_usage : given.a_usage_boundary
{
    object[] _events;
    AgentSessionUsageRecorded _expected;
    AgentSessionUsageRecorded _prepared;
    void Because()
    {
        var boundary = _command.Provide(_clock, _snapshots);
        _prepared = boundary.Usage;
        _events = _command.Handle(boundary).ToArray();
        var legacy = new RecordAgentSessionUsage(_session, _command.Agent, _command.Model, _command.Purpose, _provider, _command.Harness, _command.InputTokens, _command.OutputTokens, _command.CachedTokens, _command.CostUsd, _command.CpuSeconds, _command.MemoryBytes, _command.Duration);
        _expected = legacy.Handle(legacy.Provide(_clock)).Item2;
    }
    [Fact] void should_target_the_session_stream() => _command.GetEventSourceId().ShouldEqual((EventSourceId)_session);
    [Fact] void should_emit_exactly_two_events() => _events.Length.ShouldEqual(2);
    [Fact] void should_emit_the_unchanged_usage_event_first() => _events[0].ShouldEqual(_expected);
    [Fact] void should_emit_the_correlated_companion_second() => _events[1].ShouldEqual(new AgentSessionCapacityObserved(_session, _command.Agent, _command.Purpose, AgentSessionCapacityBoundaryKind.UsageRecorded, _snapshot));
    [Fact] void should_capture_exactly_once_for_the_actual_provider() => _snapshots.Received(1).Capture(_provider);
    [Fact] void should_not_duplicate_usage() => _events.OfType<AgentSessionUsageRecorded>().Count().ShouldEqual(1);
    [Fact] void should_reuse_the_prepared_legacy_event() => ReferenceEquals(_events[0], _prepared).ShouldBeTrue();
}
