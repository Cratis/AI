// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

/// <summary>
/// Specifies unchanged non-batch placement and additive eviction protection.
/// </summary>
public class and_the_node_pool_is_not_batch : Specification
{
    Dictionary<string, V1Job> _jobs;

    void Because()
    {
        var worker = new WorkerJob(AgentSessionId.New(), "cratis/ai-agents-pi:latest", new Dictionary<string, string>(), new Dictionary<string, string>());
        _jobs = new[] { "compute", "data", "other", "Batch", string.Empty, " " }
            .ToDictionary(pool => pool, pool => KubernetesWorkerRuntime.BuildJobSpecification(worker, nodePoolWorkload: pool));
        _jobs.Add("omitted", KubernetesWorkerRuntime.BuildJobSpecification(worker));
        _jobs.Add("null", KubernetesWorkerRuntime.BuildJobSpecification(worker, nodePoolWorkload: null));
    }

    [Fact] void should_cover_all_non_batch_cases() => _jobs.Count.ShouldEqual(8);
    [Fact] void should_not_pack_any_non_batch_workers() => _jobs.Values.All(job => job.Spec.Template.Spec.Affinity is null).ShouldBeTrue();
    [Fact] void should_keep_soft_spread_for_every_non_batch_worker() => _jobs.Values.All(job => job.Spec.Template.Spec.TopologySpreadConstraints.Single().WhenUnsatisfiable == "ScheduleAnyway").ShouldBeTrue();
    [Fact] void should_keep_the_spread_skew() => _jobs.Values.All(job => job.Spec.Template.Spec.TopologySpreadConstraints.Single().MaxSkew == 1).ShouldBeTrue();
    [Fact] void should_keep_the_spread_topology() => _jobs.Values.All(job => job.Spec.Template.Spec.TopologySpreadConstraints.Single().TopologyKey == "kubernetes.io/hostname").ShouldBeTrue();
    [Fact] void should_keep_spread_selecting_the_worker_identity() => _jobs.Values.All(job => job.Spec.Template.Spec.TopologySpreadConstraints.Single().LabelSelector.MatchLabels["cratis.io/agent-workload"] == "worker").ShouldBeTrue();
    [Fact] void should_preserve_explicit_node_pools() => _jobs.Where(pair => new[] { "compute", "data", "other", "Batch" }.Contains(pair.Key)).All(pair => pair.Value.Spec.Template.Spec.NodeSelector["workload"] == pair.Key).ShouldBeTrue();
    [Fact] void should_leave_unconfigured_node_pools_unrestricted() => _jobs.Where(pair => new[] { "", " ", "omitted", "null" }.Contains(pair.Key)).All(pair => pair.Value.Spec.Template.Spec.NodeSelector is null && pair.Value.Spec.Template.Spec.Tolerations is null).ShouldBeTrue();
    [Fact] void should_protect_every_worker_from_autoscaler_eviction() => _jobs.Values.All(job => job.Spec.Template.Metadata.Annotations["cluster-autoscaler.kubernetes.io/safe-to-evict"] == "false").ShouldBeTrue();
    [Fact] void should_keep_every_pods_network_policy_label() => _jobs.Values.All(job => job.Spec.Template.Metadata.Labels["cratis.io/agent-workload"] == "worker").ShouldBeTrue();
}
