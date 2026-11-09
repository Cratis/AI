// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class when_cancelled_before_publication : given.a_launch
{
    void Establish() => _client.Exec.InspectContainerExecAsync("4", Arg.Any<CancellationToken>())
        .Returns(_ => Task.FromException<ContainerExecInspectResponse>(new OperationCanceledException()));

    Task Because() => Launch();

    [Fact] void should_not_publish() => _operations.ShouldNotContain("ready");
    [Fact] void should_fail_closed() => _error.ShouldBeOfExactType<DockerWorkerLaunchFailed>();
    [Fact] void should_force_remove() => _client.Containers.Received().RemoveContainerAsync("worker", Arg.Is<ContainerRemoveParameters>(parameters => parameters.Force == true), Arg.Any<CancellationToken>());
}
