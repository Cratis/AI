// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_a_cleanup_failure : given.a_launch
{
    void Establish()
    {
        _client.Containers.ExtractArchiveToContainerAsync("worker", Arg.Any<CopyToContainerParameters>(), Arg.Any<Stream>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromException(new IOException("fixture-sensitive-value")));
        _client.Containers.RemoveContainerAsync("worker", Arg.Any<ContainerRemoveParameters>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromException(new IOException("fixture-sensitive-value")));
    }

    Task Because() => Launch();

    [Fact] void should_report_unconfirmed_cleanup() => _error.Message.ShouldContain("cleanup could not be confirmed");
    [Fact] void should_not_leak_either_engine_error() => _error.ToString().ShouldNotContain("fixture-sensitive-value");
    [Fact] void should_never_release_the_gate() => _operations.ShouldNotContain("ready");
}
