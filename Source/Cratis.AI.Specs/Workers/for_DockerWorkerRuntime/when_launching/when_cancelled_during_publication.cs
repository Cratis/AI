// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class when_cancelled_during_publication : given.a_launch
{
    CancellationTokenSource _cancellation;

    void Establish()
    {
        _cancellation = new();
        _client.Exec.InspectContainerExecAsync("5", Arg.Any<CancellationToken>()).Returns(async _ =>
        {
            await _cancellation.CancelAsync();
            return await Task.FromCanceled<ContainerExecInspectResponse>(_cancellation.Token);
        });
    }

    Task Because() => Launch(_cancellation.Token);

    void Destroy() => _cancellation.Dispose();

    [Fact] void should_treat_publication_as_ambiguous() => _operations.ShouldContain("ready");
    [Fact] void should_not_report_success() => _error.ShouldBeOfExactType<DockerWorkerLaunchFailed>();
    [Fact] void should_force_remove_independent_of_cancellation() => _client.Containers.Received().RemoveContainerAsync("worker", Arg.Is<ContainerRemoveParameters>(parameters => parameters.Force == true), Arg.Is<CancellationToken>(token => !token.IsCancellationRequested));
    [Fact] void should_dispose_all_streams() => _streams.TrueForAll(stream => stream.Disposed).ShouldBeTrue();
}
