// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class and_the_job_has_labels : Specification
{
    Dictionary<string, string> _labels;
    CreateContainerParameters _result;

    void Establish() => _labels = new() { ["example.owner"] = "a-worker" };

    void Because() => _result = DockerWorkerRuntime.BuildContainerSpecification(
        new WorkerJob(AgentSessionId.New(), "example/worker:latest", new Dictionary<string, string>(), new Dictionary<string, string>()) { Labels = _labels });

    [Fact] void should_put_the_labels_on_the_container() => _result.Labels.ShouldContainOnly(_labels);
    [Fact] void should_copy_the_labels() => ReferenceEquals(_result.Labels, _labels).ShouldBeFalse();
}
