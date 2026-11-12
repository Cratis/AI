// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class when_exec_never_finishes : given.a_launch
{
    void Establish() => _client.Exec.InspectContainerExecAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
        .Returns(Task.FromResult(new ContainerExecInspectResponse { Running = true, ExitCode = null }));

    Task Because() => Launch();

    [Fact] void should_fail_after_bounded_completion_checks() => _error.ShouldBeOfExactType<DockerWorkerLaunchFailed>();
    [Fact] void should_not_release_the_gate() => _operations.ShouldNotContain("ready");
    [Fact] void should_not_send_credentials() => _operations.ShouldNotContain("write");
    [Fact] void should_dispose_the_stream() => _streams.TrueForAll(stream => stream.Disposed).ShouldBeTrue();
    [Fact] void should_force_remove() => _client.Containers.Received().RemoveContainerAsync("worker", Arg.Is<ContainerRemoveParameters>(parameters => parameters.Force == true), Arg.Any<CancellationToken>());
}
