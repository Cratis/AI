// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

public class and_a_repository_cache_is_configured : Specification
{
    V1Job _result;

    void Because() =>
        _result = KubernetesWorkerRuntime.BuildJobSpecification(
            new WorkerJob(AgentSessionId.New(), "worker:latest", new Dictionary<string, string>(), new Dictionary<string, string>()),
            "/repos",
            "repository-cache",
            "DIRECT_REPOSITORY_CACHE");

    [Fact] void should_not_mount_an_unrequested_cache() => _result.Spec.Template.Spec.Volumes.ShouldNotContain(volume => volume.PersistentVolumeClaim is not null);
    [Fact] void should_not_set_cache_environment() => _result.Spec.Template.Spec.Containers[0].Env.ShouldNotContain(variable => variable.Name == "DIRECT_REPOSITORY_CACHE");
}
