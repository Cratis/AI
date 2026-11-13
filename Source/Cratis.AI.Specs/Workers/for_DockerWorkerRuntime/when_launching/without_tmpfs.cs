// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class without_tmpfs : given.a_launch
{
    void Establish() => _client.Exec.InspectContainerExecAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
        .Returns(Task.FromResult(new ContainerExecInspectResponse { ExitCode = 1 }));

    Task Because() => Launch();

    [Fact] void should_not_send_credentials() => _operations.ShouldNotContain("write");
    [Fact] void should_not_release_the_gate() => _operations.ShouldNotContain("ready");
    [Fact] void should_fail_the_launch() => _error.ShouldBeOfExactType<DockerWorkerLaunchFailed>();
}
