// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class with_scoped_cache_access : Specification
{
    const string Key = "v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    CreateContainerParameters _result;
    CreateContainerParameters _withoutResolvedBinds;

    void Because()
    {
        var environment = new Dictionary<string, string>
        {
            ["DIRECT_MEMORY_PATH"] = "/other", ["direct_memory_path"] = "/other",
            ["DIRECT_REPOSITORY_CACHE"] = "/other", ["direct_repository_cache"] = "/other",
            ["CUSTOM_CACHE"] = "/other", ["custom_cache"] = "/other",
            ["CRATIS_WORKER_REPOSITORY_MIRRORS"] = "/other", ["cratis_worker_repository_mirrors"] = "/other"
        };
        var job = new WorkerJob(AgentSessionId.New(), "worker", environment, new Dictionary<string, string>()) { Cache = new(Key, [new("https://example.invalid/owner/allowed.git", "example.invalid/owner/allowed.git")]) };
        _result = DockerWorkerRuntime.BuildContainerSpecificationWithCacheBinds(
            job,
            ["/repos/example.invalid/owner/allowed.git:/repos/example.invalid/owner/allowed.git:ro", $"/repos/.agent-memory/{Key}:/repos/.agent-memory/{Key}:rw"],
            "/repos",
            "CUSTOM_CACHE");
        _withoutResolvedBinds = DockerWorkerRuntime.BuildContainerSpecification(job, "/repos", "CUSTOM_CACHE");
    }

    [Fact] void should_mount_the_repository_read_only() => _result.HostConfig.Binds.ShouldContain("/repos/example.invalid/owner/allowed.git:/repos/example.invalid/owner/allowed.git:ro");
    [Fact] void should_mount_only_the_memory_key_read_write() => _result.HostConfig.Binds.Single(bind => !bind.EndsWith(":ro", StringComparison.Ordinal)).ShouldEqual($"/repos/.agent-memory/{Key}:/repos/.agent-memory/{Key}:rw");
    [Fact] void should_put_memory_inside_the_writable_mount() => _result.Env.ShouldContain($"DIRECT_MEMORY_PATH=/repos/.agent-memory/{Key}/memory.jsonl");
    [Fact] void should_pass_the_exact_clone_url_mapping() => _result.Env.ShouldContain("CRATIS_WORKER_REPOSITORY_MIRRORS=https://example.invalid/owner/allowed.git\t/repos/example.invalid/owner/allowed.git");
    [Fact] void should_set_the_configured_cache_variable() => _result.Env.ShouldContain("CUSTOM_CACHE=/repos");
    [Fact] void should_remove_all_caller_cache_values() => _result.Env.ShouldNotContain(variable => variable.EndsWith("=/other", StringComparison.Ordinal));
    [Fact] void should_not_mount_the_cache_or_memory_root() => _result.HostConfig.Binds.ShouldNotContain(bind => bind.Equals("/repos:/repos", StringComparison.Ordinal) || bind.Equals("/repos/.agent-memory:/repos/.agent-memory:rw", StringComparison.Ordinal));
    [Fact] void should_not_mount_unresolved_sources() => _withoutResolvedBinds.HostConfig.Binds.ShouldBeEmpty();
    [Fact] void should_not_expose_unmounted_paths() => _withoutResolvedBinds.Env.ShouldNotContain(variable => variable.StartsWith("DIRECT_MEMORY_PATH=", StringComparison.Ordinal) || variable.StartsWith("CUSTOM_CACHE=", StringComparison.Ordinal));
}
