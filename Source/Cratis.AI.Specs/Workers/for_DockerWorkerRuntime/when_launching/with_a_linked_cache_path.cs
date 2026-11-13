// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_a_linked_cache_path : Specification
{
    [Theory]
    [InlineData("owner")]
    [InlineData("owner/repo.git")]
    [InlineData(".agent-memory")]
    [InlineData(".agent-memory/v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    async Task should_refuse_before_contacting_the_engine(string relative)
    {
        if (OperatingSystem.IsWindows()) return;
        var root = Directory.CreateTempSubdirectory();
        var target = Directory.CreateTempSubdirectory();
        try
        {
            var path = Path.Combine(root.FullName, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            Directory.CreateSymbolicLink(path, target.FullName);
            var options = new WorkerRuntimeOptions { RepositoryCachePath = root.FullName, DockerEndpoint = "http://127.0.0.1:1" };
            var runtime = new DockerWorkerRuntime(Options.Create(options), Microsoft.Extensions.Logging.Abstractions.NullLogger<DockerWorkerRuntime>.Instance);
            var job = new WorkerJob(AgentSessionId.New(), "worker", new Dictionary<string, string>(), new Dictionary<string, string>())
            {
                Cache = new("v1-" + new string('a', 64), ["owner/repo.git"])
            };
            var client = Substitute.For<IDockerClient>();
            (await runtime.Start(job, TestContext.Current.CancellationToken)).ShouldEqual(WorkerLaunchOutcome.InvalidCache);
            (await runtime.Start(client, job, TestContext.Current.CancellationToken)).ShouldEqual(WorkerLaunchOutcome.InvalidCache);
            client.ReceivedCalls().ShouldBeEmpty();
        }
        finally
        {
            root.Delete(true);
            target.Delete(true);
        }
    }
}
