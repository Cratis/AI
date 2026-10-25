// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Usage;
using k8s;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

/// <summary>
/// Specifies batch packing while preserving worker protections.
/// </summary>
public class and_the_node_pool_is_batch : Specification
{
    V1Job _job;
    V1PodSpec _pod;
    IList<V1WeightedPodAffinityTerm> _terms;

    void Because()
    {
        var worker = new WorkerJob(AgentSessionId.New(), "cratis/ai-agents-pi:latest", new Dictionary<string, string>(), new Dictionary<string, string>());
        _job = KubernetesWorkerRuntime.BuildJobSpecification(
            worker,
            repositoryCachePath: "/cache",
            repositoryCacheClaimName: "repository-cache",
            imagePullSecretName: "registry",
            nodePoolWorkload: "batch",
            resources: new WorkerResources("1", "2", "2Gi", "4Gi", "1Gi", "2Gi"),
            scratch: new WorkerScratch("scratch", "30Gi"));
        _pod = _job.Spec.Template.Spec;
        _terms = _pod.Affinity.PodAffinity.PreferredDuringSchedulingIgnoredDuringExecution;
    }

    [Fact] void should_prefer_two_independent_alternatives() => _terms.Count.ShouldEqual(2);
    [Fact] void should_give_both_alternatives_weight_one_hundred() => _terms.All(term => term.Weight == 100).ShouldBeTrue();
    [Fact] void should_match_ephemeral_runners() => _terms[0].PodAffinityTerm.LabelSelector.MatchLabels.ShouldContainOnly(new KeyValuePair<string, string>("actions-ephemeral-runner", "True"));
    [Fact] void should_match_managed_workers_independently() => _terms[1].PodAffinityTerm.LabelSelector.MatchLabels.ShouldContainOnly(new KeyValuePair<string, string>("app.kubernetes.io/managed-by", "cratis-ai-agents"));
    [Fact] void should_not_add_conjunctive_expressions() => _terms.All(term => term.PodAffinityTerm.LabelSelector.MatchExpressions is null).ShouldBeTrue();
    [Fact] void should_pack_on_nodes() => _terms.All(term => term.PodAffinityTerm.TopologyKey == "kubernetes.io/hostname").ShouldBeTrue();
    [Fact] void should_serialize_an_empty_namespace_selector_for_each_alternative() => JsonDocument.Parse(KubernetesJson.Serialize(_job)).RootElement.GetProperty("spec").GetProperty("template").GetProperty("spec").GetProperty("affinity").GetProperty("podAffinity").GetProperty("preferredDuringSchedulingIgnoredDuringExecution").EnumerateArray().All(term => !term.GetProperty("podAffinityTerm").GetProperty("namespaceSelector").EnumerateObject().Any()).ShouldBeTrue();
    [Fact] void should_not_restrict_namespaces_by_name() => _terms.All(term => term.PodAffinityTerm.Namespaces is null).ShouldBeTrue();
    [Fact] void should_not_require_existing_batch_pods() => _pod.Affinity.PodAffinity.RequiredDuringSchedulingIgnoredDuringExecution.ShouldBeNull();
    [Fact] void should_not_counteract_packing_with_spread() => _pod.TopologySpreadConstraints.ShouldBeNull();
    [Fact] void should_keep_the_batch_node_selector() => _pod.NodeSelector["workload"].ShouldEqual("batch");
    [Fact] void should_keep_the_batch_toleration() => _pod.Tolerations.Single().Value.ShouldEqual("batch");
    [Fact] void should_keep_the_no_schedule_taint_boundary() => _pod.Tolerations.Single().Effect.ShouldEqual("NoSchedule");
    [Fact] void should_keep_the_exact_taint_match() => _pod.Tolerations.Single().OperatorProperty.ShouldEqual("Equal");
    [Fact] void should_protect_the_pod_from_autoscaler_eviction() => _job.Spec.Template.Metadata.Annotations["cluster-autoscaler.kubernetes.io/safe-to-evict"].ShouldEqual("false");
    [Fact] void should_keep_the_job_managed_by_label() => _job.Metadata.Labels["app.kubernetes.io/managed-by"].ShouldEqual("cratis-ai-agents");
    [Fact] void should_keep_the_pod_managed_by_label() => _job.Spec.Template.Metadata.Labels["app.kubernetes.io/managed-by"].ShouldEqual("cratis-ai-agents");
    [Fact] void should_keep_the_network_policy_identity() => _job.Spec.Template.Metadata.Labels["cratis.io/agent-workload"].ShouldEqual("worker");
    [Fact] void should_keep_resource_requests() => _pod.Containers.Single().Resources.Requests["cpu"].ToString().ShouldEqual("1");
    [Fact] void should_keep_resource_limits() => _pod.Containers.Single().Resources.Limits["memory"].ToString().ShouldEqual("4Gi");
    [Fact] void should_keep_the_read_only_repository_cache() => _pod.Volumes.Single(volume => volume.Name == "repository-cache").PersistentVolumeClaim.ReadOnlyProperty.ShouldEqual(true);
    [Fact] void should_keep_the_scratch_volume() => _pod.Volumes.Single(volume => volume.Name == WorkerScratch.VolumeName).Ephemeral.VolumeClaimTemplate.Spec.StorageClassName.ShouldEqual("scratch");
    [Fact] void should_keep_the_image_pull_secret() => _pod.ImagePullSecrets.Single().Name.ShouldEqual("registry");
    [Fact] void should_keep_service_account_tokens_unmounted() => _pod.AutomountServiceAccountToken.ShouldEqual(false);
    [Fact] void should_keep_non_root_execution() => _pod.SecurityContext.RunAsNonRoot.ShouldEqual(true);
    [Fact] void should_keep_privilege_escalation_disabled() => _pod.Containers.Single().SecurityContext.AllowPrivilegeEscalation.ShouldEqual(false);
    [Fact] void should_keep_capabilities_dropped() => _pod.Containers.Single().SecurityContext.Capabilities.Drop.ShouldContainOnly("ALL");
    [Fact] void should_keep_the_shutdown_grace() => _pod.TerminationGracePeriodSeconds.ShouldEqual(120L);
    [Fact] void should_keep_the_job_deadline() => _job.Spec.ActiveDeadlineSeconds.ShouldEqual(172800L);
    [Fact] void should_keep_retries_disabled() => _job.Spec.BackoffLimit.ShouldEqual(0);
}
