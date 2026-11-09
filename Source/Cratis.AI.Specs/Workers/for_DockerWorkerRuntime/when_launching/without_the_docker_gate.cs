// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class without_the_docker_gate : given.an_entrypoint_gate
{
    void Establish()
    {
        _file = string.Empty;
        _required = false;
    }

    Task Because() => RunGate();

    [Fact] void should_preserve_the_existing_entrypoint_behavior() => _exitCode.ShouldEqual(0);
    [Fact] void should_continue_without_docker_delivery() => _output.ShouldContain("agent-started");
}
