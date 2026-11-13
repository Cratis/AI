// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class with_unselected_cache_binds : Specification
{
    [Theory]
    [InlineData("/repos:/repos:ro")]
    [InlineData("/repos/other.git:/repos/owner/allowed.git:ro")]
    [InlineData("/repos/owner/allowed.git:/repos/owner/allowed.git:rw")]
    void should_refuse_the_bind(string bind)
    {
        var job = new WorkerJob(AgentSessionId.New(), "worker", new Dictionary<string, string>(), new Dictionary<string, string>())
        {
            Cache = new("v1-" + new string('a', 64), [new("https://example.invalid/owner/allowed.git", "owner/allowed.git")])
        };
        Catch.Exception(() => DockerWorkerRuntime.BuildContainerSpecificationWithCacheBinds(job, [bind], "/repos")).ShouldBeOfExactType<ArgumentException>();
    }
}
