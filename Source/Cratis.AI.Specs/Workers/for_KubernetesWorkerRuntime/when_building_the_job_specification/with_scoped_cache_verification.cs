// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

public class with_scoped_cache_verification : Specification
{
    const string Key = "v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    V1Container _verification;

    void Because()
    {
        var job = new WorkerJob(AgentSessionId.New(), "worker", new Dictionary<string, string> { ["CUSTOM"] = "job-value" }, new Dictionary<string, string> { ["PRIVATE_KEY"] = "synthetic-value" })
        {
            Cache = new(Key, [new("https://example.invalid/owner/allowed.git", "example.invalid/owner/allowed.git"), new("https://example.invalid/group/nested/second.git", "example.invalid/group/nested/second.git")])
        };
        var pod = KubernetesWorkerRuntime.BuildJobSpecification(job, "/repos", "test-claim", "CUSTOM_CACHE").Spec.Template.Spec;
        _verification = pod.InitContainers.Single();
    }

    [Fact] void should_verify_before_starting_the_worker() => _verification.Name.ShouldEqual("verify-worker-cache");
    [Fact] void should_use_the_same_image() => _verification.Image.ShouldEqual("worker");
    [Fact] void should_run_the_exact_directory_checks() => _verification.Args.ShouldEqual("-eu", "-c", KubernetesWorkerCacheVerification.Script, "verify-worker-cache", KubernetesWorkerCacheVerification.Root, $".agent-memory/{Key}", "example.invalid/owner/allowed.git", "example.invalid/group/nested/second.git");
    [Fact] void should_override_the_image_entrypoint() => _verification.Command.ShouldEqual("/bin/sh");
    [Fact] void should_expose_only_the_read_only_claim() => _verification.VolumeMounts.Single().ReadOnlyProperty.ShouldEqual(true);
    [Fact] void should_mount_the_claim_at_the_verification_root() => _verification.VolumeMounts.Single().MountPath.ShouldEqual(KubernetesWorkerCacheVerification.Root);
    [Fact] void should_use_the_same_claim() => _verification.VolumeMounts.Single().Name.ShouldEqual("test-claim");
    [Fact] void should_not_use_a_scoped_mount_for_verification() => _verification.VolumeMounts.Single().SubPath.ShouldBeNull();
    [Fact] void should_not_inherit_job_environment() => _verification.Env.Select(variable => variable.Name).ShouldEqual("PATH", "LC_ALL");
    [Fact] void should_not_inherit_secret_environment() => _verification.EnvFrom.ShouldBeNull();
    [Fact] void should_run_as_the_non_root_worker() => _verification.SecurityContext.RunAsUser.ShouldEqual(1655);
    [Fact] void should_require_non_root() => _verification.SecurityContext.RunAsNonRoot.ShouldEqual(true);
    [Fact] void should_use_the_worker_group() => _verification.SecurityContext.RunAsGroup.ShouldEqual(1655);
    [Fact] void should_disallow_privilege_escalation() => _verification.SecurityContext.AllowPrivilegeEscalation.ShouldEqual(false);
    [Fact] void should_have_a_read_only_root_filesystem() => _verification.SecurityContext.ReadOnlyRootFilesystem.ShouldEqual(true);
    [Fact] void should_drop_all_capabilities() => _verification.SecurityContext.Capabilities.Drop.ShouldEqual("ALL");
}
