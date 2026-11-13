// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_a_cache_ancestor_changed_during_image_pull : Specification
{
    [Theory]
    [InlineData("owner")]
    [InlineData(".agent-memory")]
    async Task should_refuse_before_creating_the_container(string relative)
    {
        if (OperatingSystem.IsWindows()) return;
        var root = Directory.CreateTempSubdirectory();
        var target = Directory.CreateTempSubdirectory();
        try
        {
            var key = "v1-" + new string('a', 64);
            Directory.CreateDirectory(Path.Combine(root.FullName, "owner/repo.git"));
            Directory.CreateDirectory(Path.Combine(root.FullName, ".agent-memory", key));
            var options = new WorkerRuntimeOptions { RepositoryCachePath = root.FullName };
            var runtime = new DockerWorkerRuntime(Options.Create(options), Microsoft.Extensions.Logging.Abstractions.NullLogger<DockerWorkerRuntime>.Instance);
            var job = new WorkerJob(AgentSessionId.New(), "worker", new Dictionary<string, string>(), new Dictionary<string, string>())
            {
                Cache = new(key, [new("https://example.invalid/owner/repo.git", "owner/repo.git")])
            };
            var client = Substitute.For<IDockerClient>();
            var pulled = false;
            client.Images.CreateImageAsync(Arg.Any<ImagesCreateParameters>(), null, Arg.Any<IProgress<JSONMessage>>(), Arg.Any<CancellationToken>()).Returns(_ =>
            {
                pulled = true;
                var ancestor = Path.Combine(root.FullName, relative);
                Directory.Move(ancestor, ancestor + ".original");
                Directory.CreateSymbolicLink(ancestor, target.FullName);
                return Task.CompletedTask;
            });

            (await runtime.Start(client, job, TestContext.Current.CancellationToken)).ShouldEqual(WorkerLaunchOutcome.InvalidCache);
            pulled.ShouldBeTrue();
            await client.Containers.DidNotReceive().CreateContainerAsync(Arg.Any<CreateContainerParameters>(), Arg.Any<CancellationToken>());
        }
        finally
        {
            root.Delete(true);
            target.Delete(true);
        }
    }
}
