// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_a_worker_owned_marker : given.a_delivered_entrypoint_gate
{
    void Establish() => _markerAttributes = "1655:444";
    Task Because() => RunDeliveredGate();

    [Fact] void should_reject_a_forged_marker() => _exitCode.ShouldEqual(1);
    [Fact] void should_not_start_an_agent() => _output.ShouldNotContain("agent-started");
}
