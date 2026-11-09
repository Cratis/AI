// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_wrong_permissions : given.a_launch
{
    void Establish() => _client.Exec.InspectContainerExecAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
        .Returns(call => Task.FromResult(new ContainerExecInspectResponse { ExitCode = call.Arg<string>() == "2" ? 1 : 0 }));

    Task Because() => Launch();

    [Fact] void should_fail_the_launch() => _error.ShouldBeOfExactType<DockerWorkerLaunchFailed>();
    [Fact] void should_never_release_the_gate() => _operations.ShouldNotContain("ready");
    [Fact] void should_remove_the_container_and_partial_payload() => _client.Containers.Received().RemoveContainerAsync("worker", Arg.Is<ContainerRemoveParameters>(parameters => parameters.Force == true), Arg.Any<CancellationToken>());
}
