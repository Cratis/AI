// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class with_negative_resource_limits : Specification
{
    List<Exception> _errors;

    void Because()
    {
        _errors = [];
        foreach (var limits in new WorkerLimits[] { new(MemoryBytes: -1), new(NanoCpus: -1), new(PidsLimit: -1) })
        {
            var job = new WorkerJob(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string>()) { Limits = limits };
            _errors.Add(Catch.Exception(() => DockerWorkerRuntime.BuildContainerSpecification(job, null)));
        }
    }

    [Fact] void should_reject_each_negative_limit() => _errors.TrueForAll(error => error is DockerWorkerLaunchFailed).ShouldBeTrue();
    [Fact] void should_check_all_three_limits() => _errors.Count.ShouldEqual(3);
}
