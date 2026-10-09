// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

public class and_a_restricted_checkout_has_a_configured_cache : Specification
{
    V1Job _result;
    V1Job _emptyContract;

    void Because()
    {
        var environment = new Dictionary<string, string>
        {
            ["DIRECT_REPOSITORY_CHECKOUTS"] = "[{}]",
            ["DIRECT_REPOSITORY_CACHE"] = "/repos",
            ["CUSTOM_CACHE"] = "/repos",
            ["UNCHANGED"] = "value"
        };
        var job = new WorkerJob(AgentSessionId.New(), "worker:latest", environment, new Dictionary<string, string>());
        _result = KubernetesWorkerRuntime.BuildJobSpecification(job, "/repos", "repository-cache", "CUSTOM_CACHE");
        environment["DIRECT_REPOSITORY_CHECKOUTS"] = string.Empty;
        _emptyContract = KubernetesWorkerRuntime.BuildJobSpecification(job, "/repos", "repository-cache", "CUSTOM_CACHE");
    }

    [Fact] void should_omit_the_shared_cache() => _result.Spec.Template.Spec.Volumes.ShouldNotContain(volume => volume.PersistentVolumeClaim is not null);
    [Fact] void should_omit_cache_environment_even_if_supplied_by_the_caller() => _result.Spec.Template.Spec.Containers[0].Env.ShouldNotContain(variable => variable.Name == "CUSTOM_CACHE" || variable.Name == "DIRECT_REPOSITORY_CACHE");
    [Fact] void should_omit_the_cache_mount() => _result.Spec.Template.Spec.Containers[0].VolumeMounts.ShouldNotContain(mount => mount.MountPath == "/repos");
    [Fact] void should_preserve_other_environment() => _result.Spec.Template.Spec.Containers[0].Env.ShouldContain(variable => variable.Name == "UNCHANGED" && variable.Value == "value");
    [Fact] void should_omit_the_cache_for_an_empty_contract() => _emptyContract.Spec.Template.Spec.Volumes.ShouldNotContain(volume => volume.PersistentVolumeClaim is not null);
}
