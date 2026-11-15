// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Usage;
using k8s;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

/// <summary>
/// Specifies the configured worker pod priority class.
/// </summary>
public class and_a_priority_class_is_set : Specification
{
    V1Job _job;

    void Because()
    {
        var worker = new WorkerJob(AgentSessionId.New(), "cratis/ai-agents-pi:latest", new Dictionary<string, string>(), new Dictionary<string, string>());
        _job = KubernetesWorkerRuntime.BuildJobSpecification(worker, priorityClassName: "batch-workers");
    }

    [Fact] void should_set_the_pod_priority_class() => _job.Spec.Template.Spec.PriorityClassName.ShouldEqual("batch-workers");
    [Fact] void should_serialize_the_pod_priority_class() => JsonElement.Parse(KubernetesJson.Serialize(_job)).GetProperty("spec").GetProperty("template").GetProperty("spec").GetProperty("priorityClassName").GetString().ShouldEqual("batch-workers");
}
