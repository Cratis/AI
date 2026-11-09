// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_a_trusted_marker : given.a_delivered_entrypoint_gate
{
    Task Because() => RunDeliveredGate();

    [Fact] void should_accept_the_verified_marker() => _exitCode.ShouldEqual(0);
    [Fact] void should_release_the_gate() => _output.ShouldContain("agent-started");
}
