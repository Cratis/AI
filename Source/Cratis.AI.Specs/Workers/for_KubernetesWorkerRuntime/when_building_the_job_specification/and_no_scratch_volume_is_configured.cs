// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

/// <summary>
/// A class without a size, or a size without a class, is not a scratch volume - the workspace stays
/// in the container layer and the specification comes out as it did before scratch volumes existed.
/// </summary>
public class and_no_scratch_volume_is_configured : Specification
{
    V1Job _omitted;
    V1Job _classOnly;
    V1Job _sizeOnly;

    void Because()
    {
        var job = new WorkerJob(AgentSessionId.New(), "cratis/ai-agents-claude:latest", new Dictionary<string, string>(), new Dictionary<string, string>());
        _omitted = KubernetesWorkerRuntime.BuildJobSpecification(job);
        _classOnly = KubernetesWorkerRuntime.BuildJobSpecification(job, scratch: new WorkerScratch("upcloud-scratch"));
        _sizeOnly = KubernetesWorkerRuntime.BuildJobSpecification(job, scratch: new WorkerScratch(Size: "30Gi"));
    }

    [Fact] void should_have_no_init_containers() => _omitted.Spec.Template.Spec.InitContainers.ShouldBeNull();
    [Fact] void should_not_set_an_fs_group() => _omitted.Spec.Template.Spec.SecurityContext.FsGroup.ShouldBeNull();
    [Fact] void should_ignore_a_class_without_a_size() => KubernetesYaml.Serialize(_classOnly).ShouldEqual(KubernetesYaml.Serialize(_omitted));
    [Fact] void should_ignore_a_size_without_a_class() => KubernetesYaml.Serialize(_sizeOnly).ShouldEqual(KubernetesYaml.Serialize(_omitted));
}
