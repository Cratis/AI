// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Capacity;

namespace Cratis.AI.Usage.Recording.for_RecordAgentSessionUsageWithCapacity.when_handling;

public class and_capture_throws : given.a_usage_boundary
{
    object[] _events;
    void Establish() => _snapshots.Capture(_provider).Returns(_ => throw new InvalidOperationException("private"));
    void Because() => _events = _command.Handle(_command.Provide(_clock, _snapshots)).ToArray();
    [Fact] void should_still_emit_ordinary_usage() => _events.OfType<AgentSessionUsageRecorded>().Single().InputTokens.Value.ShouldEqual(120L);
    [Fact] void should_emit_an_unavailable_companion() => _events.OfType<AgentSessionCapacityObserved>().Single().Snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Unavailable);
    [Fact] void should_emit_only_a_sanitized_reason() => _events.OfType<AgentSessionCapacityObserved>().Single().Snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.CaptureFailed);
}
