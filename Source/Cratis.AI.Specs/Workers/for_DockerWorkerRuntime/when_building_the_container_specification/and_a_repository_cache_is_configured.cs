// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

/// <summary>
/// The Docker equivalent of the Kubernetes PVC mount: a bind mount at whatever path is configured,
/// host path equal to container path, and - when an environment variable name is also given - a
/// variable telling the entrypoint where to find it.
/// </summary>
public class and_a_repository_cache_is_configured : Specification
{
    CreateContainerParameters _result;

    void Because() =>
        _result = DockerWorkerRuntime.BuildContainerSpecification(
            new WorkerJob(AgentSessionId.New(), "cratis/ai-agents-claude:latest", new Dictionary<string, string>(), new Dictionary<string, string>()),
            "/repos",
            "DIRECT_REPOSITORY_CACHE");

    [Fact]
    void should_bind_mount_the_repository_cache_at_the_configured_path() =>
        _result.HostConfig.Binds.ShouldContain("/repos:/repos");

    [Fact]
    void should_tell_the_entrypoint_where_the_cache_is_mounted() =>
        _result.Env.ShouldContain("DIRECT_REPOSITORY_CACHE=/repos");
}
