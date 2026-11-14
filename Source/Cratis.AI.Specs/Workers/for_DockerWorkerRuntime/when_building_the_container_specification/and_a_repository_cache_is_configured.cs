// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class and_a_repository_cache_is_configured : Specification
{
    CreateContainerParameters _result;

    void Because() =>
        _result = DockerWorkerRuntime.BuildContainerSpecification(
            new WorkerJob(AgentSessionId.New(), "worker:latest", new Dictionary<string, string>(), new Dictionary<string, string>()),
            "/repos",
            "DIRECT_REPOSITORY_CACHE");

    [Fact] void should_not_mount_an_unrequested_cache() => _result.HostConfig.Binds.ShouldBeEmpty();
    [Fact] void should_not_set_cache_environment() => _result.Env.ShouldNotContain("DIRECT_REPOSITORY_CACHE=/repos");
}
