// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

/// <summary>
/// Local/Docker dev, and any deployment that has not configured a repository cache - the
/// specification must come out byte-identical to before the repository cache existed, whether the
/// parameters are omitted entirely or passed as explicit <see langword="null"/>/empty values.
/// </summary>
public class and_no_repository_cache_is_configured : Specification
{
    static WorkerJob Job() => new(AgentSessionId.New(), "cratis/ai-agents-claude:latest", new Dictionary<string, string>(), new Dictionary<string, string>());

    V1Job _omitted;
    V1Job _explicitNull;
    V1Job _explicitEmpty;

    void Because()
    {
        var job = Job();
        _omitted = KubernetesWorkerRuntime.BuildJobSpecification(job);
        _explicitNull = KubernetesWorkerRuntime.BuildJobSpecification(job, null, null, null);
        _explicitEmpty = KubernetesWorkerRuntime.BuildJobSpecification(job, string.Empty, string.Empty, string.Empty);
    }

    [Fact]
    void should_only_have_the_secrets_volume() => _omitted.Spec.Template.Spec.Volumes.Count.ShouldEqual(1);

    [Fact]
    void should_only_mount_the_secrets_volume() => _omitted.Spec.Template.Spec.Containers[0].VolumeMounts.Count.ShouldEqual(1);

    [Fact]
    void should_not_set_any_repository_cache_environment_variable() =>
        _omitted.Spec.Template.Spec.Containers[0].Env.ShouldNotContain(variable => variable.Name.Contains("REPOSITORY_CACHE", StringComparison.Ordinal));

    [Fact]
    void should_be_the_same_whether_omitted_or_explicitly_null() =>
        KubernetesYaml.Serialize(_omitted).ShouldEqual(KubernetesYaml.Serialize(_explicitNull));

    [Fact]
    void should_be_the_same_whether_omitted_or_explicitly_empty() =>
        KubernetesYaml.Serialize(_omitted).ShouldEqual(KubernetesYaml.Serialize(_explicitEmpty));
}
