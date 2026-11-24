// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Capacity;

namespace Cratis.AI.Usage.Recording.for_RecordAgentSessionUsageWithCapacity.when_handling;

public class without_a_resolved_provider : given.a_usage_boundary
{
    object[] _events;
    void Establish() => _command = _command with { Provider = null };
    void Because() => _events = _command.Handle(_command.Provide(_clock, _snapshots)).ToArray();
    [Fact] void should_not_call_the_capture_service() => _snapshots.DidNotReceiveWithAnyArgs().Capture(default!);
    [Fact] void should_preserve_the_legacy_unresolved_provider() => _events.OfType<AgentSessionUsageRecorded>().Single().Provider.ShouldBeNull();
    [Fact] void should_explain_the_missing_provider() => _events.OfType<AgentSessionCapacityObserved>().Single().Snapshot.Reason.ShouldEqual(AIProviderCapacitySnapshotReason.ProviderNotResolved);
}
