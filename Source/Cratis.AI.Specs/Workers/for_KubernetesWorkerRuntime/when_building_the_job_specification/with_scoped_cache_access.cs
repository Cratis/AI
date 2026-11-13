// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

public class with_scoped_cache_access : Specification
{
    const string Key = "v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    V1PodSpec _pod;
    V1Container _container;

    void Because()
    {
        var environment = new Dictionary<string, string>
        {
            ["DIRECT_MEMORY_PATH"] = "/other", ["direct_memory_path"] = "/other",
            ["DIRECT_REPOSITORY_CACHE"] = "/other", ["direct_repository_cache"] = "/other",
            ["CUSTOM_CACHE"] = "/other", ["custom_cache"] = "/other",
            ["CRATIS_WORKER_REPOSITORY_MIRRORS"] = "/other", ["cratis_worker_repository_mirrors"] = "/other"
        };
        var job = new WorkerJob(AgentSessionId.New(), "worker", environment, new Dictionary<string, string>()) { Cache = new(Key, [new("https://example.invalid/owner/allowed.git", "example.invalid/owner/allowed.git"), new("https://example.invalid/group/nested/second.git", "example.invalid/group/nested/second.git")]) };
        _pod = KubernetesWorkerRuntime.BuildJobSpecification(job, "/repos", "test-claim", "CUSTOM_CACHE").Spec.Template.Spec;
        _container = _pod.Containers[0];
    }

    [Fact] void should_attach_one_writable_claim() => _pod.Volumes.Count(volume => volume.PersistentVolumeClaim?.ClaimName == "test-claim" && volume.PersistentVolumeClaim.ReadOnlyProperty != true).ShouldEqual(1);
    [Fact] void should_mount_only_subpaths() => _container.VolumeMounts.ShouldNotContain(mount => mount.Name == "test-claim" && string.IsNullOrEmpty(mount.SubPath));
    [Fact] void should_mount_the_repositories_read_only() => _container.VolumeMounts.Count(mount => mount.Name == "test-claim" && mount.ReadOnlyProperty == true).ShouldEqual(2);
    [Fact] void should_mount_the_selected_repository() => _container.VolumeMounts.ShouldContain(mount => mount.SubPath == "example.invalid/owner/allowed.git" && mount.MountPath == "/repos/example.invalid/owner/allowed.git" && mount.ReadOnlyProperty == true);
    [Fact] void should_mount_only_the_memory_key_read_write() => _container.VolumeMounts.Single(mount => mount.Name == "test-claim" && mount.ReadOnlyProperty != true).SubPath.ShouldEqual($".agent-memory/{Key}");
    [Fact] void should_put_memory_inside_the_writable_mount() => _container.Env.ShouldContain(variable => variable.Name == "DIRECT_MEMORY_PATH" && variable.Value == $"/repos/.agent-memory/{Key}/memory.jsonl");
    [Fact] void should_pass_exact_clone_url_mappings() => _container.Env.ShouldContain(variable => variable.Name == "CRATIS_WORKER_REPOSITORY_MIRRORS" && variable.Value == "https://example.invalid/owner/allowed.git\t/repos/example.invalid/owner/allowed.git\nhttps://example.invalid/group/nested/second.git\t/repos/example.invalid/group/nested/second.git");
    [Fact] void should_set_the_configured_cache_variable() => _container.Env.ShouldContain(variable => variable.Name == "CUSTOM_CACHE" && variable.Value == "/repos");
    [Fact] void should_remove_all_caller_cache_values() => _container.Env.ShouldNotContain(variable => variable.Value == "/other");
    [Fact] void should_not_mount_the_memory_root_or_legacy_directory() => _container.VolumeMounts.ShouldNotContain(mount => string.Equals(mount.SubPath, ".agent-memory", StringComparison.Ordinal) || string.Equals(mount.SubPath, ".agent-memory/Cratis", StringComparison.Ordinal));
}
