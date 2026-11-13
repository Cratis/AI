// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class when_container_creation_fails : given.a_launch
{
    void Establish() => _client.Containers.CreateContainerAsync(Arg.Any<CreateContainerParameters>(), Arg.Any<CancellationToken>())
        .Returns(_ => Task.FromException<CreateContainerResponse>(new IOException("fixture-sensitive-value")));

    Task Because() => Launch();

    [Fact] void should_sanitize_the_error() => _error.ShouldBeOfExactType<DockerWorkerLaunchFailed>();
    [Fact] void should_not_preserve_an_inner_exception() => _error.InnerException.ShouldBeNull();
    [Fact] void should_not_disclose_daemon_text() => _error.Message.ShouldNotContain("fixture-sensitive-value");
    [Fact] void should_not_start_a_container() => _operations.ShouldBeEmpty();
}
