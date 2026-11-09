// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class with_resource_limits : Specification
{
    CreateContainerParameters _specification;

    void Because()
    {
        var job = new WorkerJob(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string>())
        {
            Limits = new(MemoryBytes: 536870912, NanoCpus: 1500000000, PidsLimit: 256)
        };
        _specification = DockerWorkerRuntime.BuildContainerSpecification(job, "/callback");
    }

    [Fact] void should_set_the_memory_ceiling() => _specification.HostConfig.Memory.ShouldEqual(536870912L);
    [Fact] void should_disable_swap_by_matching_the_memory_ceiling() => _specification.HostConfig.MemorySwap.ShouldEqual(_specification.HostConfig.Memory);
    [Fact] void should_set_the_cpu_ceiling() => _specification.HostConfig.NanoCPUs.ShouldEqual(1500000000L);
    [Fact] void should_set_the_process_ceiling() => _specification.HostConfig.PidsLimit.ShouldEqual(256L);
}
