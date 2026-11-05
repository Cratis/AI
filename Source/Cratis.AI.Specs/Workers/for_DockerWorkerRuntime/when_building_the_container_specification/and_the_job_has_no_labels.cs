// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class and_the_job_has_no_labels : Specification
{
    CreateContainerParameters _result;
    CreateContainerParameters _empty;

    void Because()
    {
        var job = new WorkerJob(AgentSessionId.New(), "example/worker:latest", new Dictionary<string, string>(), new Dictionary<string, string>());
        _result = DockerWorkerRuntime.BuildContainerSpecification(job);
        _empty = DockerWorkerRuntime.BuildContainerSpecification(job with { Labels = new Dictionary<string, string>() });
    }

    [Fact] void should_leave_labels_unset() => _result.Labels.ShouldBeNull();
    [Fact] void should_leave_empty_labels_unset() => _empty.Labels.ShouldBeNull();
}
