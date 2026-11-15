// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Usage;
using k8s;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

/// <summary>
/// Specifies omission of an unset or blank worker pod priority class.
/// </summary>
public class and_no_priority_class_is_set : Specification
{
    V1Job _defaultJob;
    V1Job[] _jobs;

    void Because()
    {
        var worker = new WorkerJob(AgentSessionId.New(), "cratis/ai-agents-pi:latest", new Dictionary<string, string>(), new Dictionary<string, string>());
        _defaultJob = KubernetesWorkerRuntime.BuildJobSpecification(worker);
        string?[] unsetNames = [null, string.Empty, " \t\r\n"];
        _jobs = unsetNames.Select(name => KubernetesWorkerRuntime.BuildJobSpecification(worker, priorityClassName: name)).ToArray();
    }

    [Fact] void should_leave_the_default_pod_priority_class_unset() => _defaultJob.Spec.Template.Spec.PriorityClassName.ShouldBeNull();
    [Fact] void should_leave_null_empty_and_whitespace_priority_classes_unset() => _jobs.All(job => job.Spec.Template.Spec.PriorityClassName is null).ShouldBeTrue();
    [Fact] void should_omit_the_default_priority_class_from_serialization() => JsonElement.Parse(KubernetesJson.Serialize(_defaultJob)).GetProperty("spec").GetProperty("template").GetProperty("spec").TryGetProperty("priorityClassName", out _).ShouldBeFalse();
    [Fact] void should_omit_null_empty_and_whitespace_priority_classes_from_serialization() => _jobs.All(job => !JsonElement.Parse(KubernetesJson.Serialize(job)).GetProperty("spec").GetProperty("template").GetProperty("spec").TryGetProperty("priorityClassName", out _)).ShouldBeTrue();
}
