// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_an_invalid_cache : Specification
{
    [Theory]
    [InlineData("owner", "owner/repo.git")]
    [InlineData("v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "../repo.git")]
    [InlineData("v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "/owner/repo.git")]
    async Task should_refuse_before_contacting_the_engine(string key, string repository)
    {
        var runtime = new DockerWorkerRuntime(Options.Create(new WorkerRuntimeOptions { DockerEndpoint = "http://127.0.0.1:1" }), Microsoft.Extensions.Logging.Abstractions.NullLogger<DockerWorkerRuntime>.Instance);
        var job = new WorkerJob(AgentSessionId.New(), "worker", new Dictionary<string, string>(), new Dictionary<string, string>()) { Cache = new(key, [repository]) };
        var client = Substitute.For<IDockerClient>();
        (await runtime.Start(job, TestContext.Current.CancellationToken)).ShouldEqual(WorkerLaunchOutcome.InvalidCache);
        (await runtime.Start(client, job, TestContext.Current.CancellationToken)).ShouldEqual(WorkerLaunchOutcome.InvalidCache);
        client.ReceivedCalls().ShouldBeEmpty();
    }
}
