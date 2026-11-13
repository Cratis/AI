// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class without_resource_limits : Specification
{
    CreateContainerParameters _absent;
    CreateContainerParameters _zero;

    void Because()
    {
        var job = new WorkerJob(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string>());
        _absent = DockerWorkerRuntime.BuildContainerSpecification(job, "/callback");
        _zero = DockerWorkerRuntime.BuildContainerSpecification(job with { Limits = new() }, "/callback");
    }

    [Fact] void should_leave_absent_memory_unlimited() => _absent.HostConfig.Memory.ShouldEqual(0L);
    [Fact] void should_leave_zero_memory_unlimited() => _zero.HostConfig.Memory.ShouldEqual(0L);
    [Fact] void should_leave_absent_swap_unlimited() => _absent.HostConfig.MemorySwap.ShouldEqual(0L);
    [Fact] void should_leave_zero_swap_unlimited() => _zero.HostConfig.MemorySwap.ShouldEqual(0L);
    [Fact] void should_leave_absent_cpu_unlimited() => _absent.HostConfig.NanoCPUs.ShouldEqual(0L);
    [Fact] void should_leave_zero_cpu_unlimited() => _zero.HostConfig.NanoCPUs.ShouldEqual(0L);
    [Fact] void should_leave_absent_processes_unlimited() => _absent.HostConfig.PidsLimit.ShouldBeNull();
    [Fact] void should_leave_zero_processes_unlimited() => _zero.HostConfig.PidsLimit.ShouldBeNull();
}
