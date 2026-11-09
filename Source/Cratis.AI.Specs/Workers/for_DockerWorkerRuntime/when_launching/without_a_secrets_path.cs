// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class without_a_secrets_path : given.an_entrypoint_gate
{
    void Establish() => _file = string.Empty;
    Task Because() => RunGate();

    [Fact] void should_fail_closed() => _exitCode.ShouldEqual(1);
    [Fact] void should_not_start_the_agent() => _output.ShouldNotContain("agent-started");
}
