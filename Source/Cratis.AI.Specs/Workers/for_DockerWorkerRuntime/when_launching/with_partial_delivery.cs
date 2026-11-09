// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_partial_delivery : given.a_launch
{
    void Establish() => _client.Containers.ExtractArchiveToContainerAsync("worker", Arg.Any<CopyToContainerParameters>(), Arg.Any<Stream>(), Arg.Any<CancellationToken>())
        .Returns(_ => Task.FromException(new IOException("fixture-sensitive-value")));

    Task Because() => Launch(new CancellationToken(canceled: true));

    [Fact] void should_fail_the_launch() => _error.ShouldBeOfExactType<DockerWorkerLaunchFailed>();
    [Fact] void should_never_release_the_gate() => _operations.ShouldNotContain("ready");
    [Fact] void should_force_remove_even_when_the_caller_cancelled() => _client.Containers.Received().RemoveContainerAsync("worker", Arg.Is<ContainerRemoveParameters>(parameters => parameters.Force == true && parameters.RemoveVolumes == true), Arg.Is<CancellationToken>(token => !token.IsCancellationRequested));
    [Fact] void should_not_leak_engine_errors() => _error.ToString().ShouldNotContain("fixture-sensitive-value");
    [Fact] void should_not_keep_an_unsafe_inner_exception() => _error.InnerException.ShouldBeNull();
    [Fact] void should_not_log_secret_values() => string.Join(' ', _logger.ReceivedCalls().SelectMany(call => call.GetArguments()).Select(argument => argument?.ToString())).ShouldNotContain("fixture-sensitive-value");
}
