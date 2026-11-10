// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class and_the_job_is_host_prepared : for_HostWorkspace.given.a_workspace
{
    CreateContainerParameters _result;

    void Establish() => _job = _job with
    {
        EnvironmentVariables = new Dictionary<string, string>(_job.EnvironmentVariables)
        {
            [HostWorkspace.ContainerPathVariable] = "/caller-path",
            ["CUSTOM_CACHE"] = "/repos",
            ["UNCHANGED"] = "value"
        }
    };

    void Because() => _result = DockerWorkerRuntime.BuildContainerSpecification(_job, "/repos", "CUSTOM_CACHE", _workspace);

    [Fact] void should_overlay_read_only_git_metadata_after_the_writable_tree() => _result.HostConfig.Binds.ShouldEqual(new[] { $"{_workspace}:/workspace:rw", $"{Path.Combine(_workspace, ".git")}:/workspace/.git:ro" });
    [Fact] void should_set_the_fixed_container_path() => _result.Env.ShouldContain("CRATIS_WORKSPACE_PATH=/workspace");
    [Fact] void should_set_the_mode_once() => _result.Env.Count(value => value == "CRATIS_WORKSPACE_MODE=host-prepared").ShouldEqual(1);
    [Fact] void should_not_leak_the_host_path() => _result.Env.ShouldNotContain(value => value.StartsWith("CRATIS_WORKSPACE_HOST_PATH=", StringComparison.Ordinal));
    [Fact] void should_omit_the_cache_environment() => _result.Env.ShouldNotContain(value => value.StartsWith("CUSTOM_CACHE=", StringComparison.Ordinal) || value.StartsWith("DIRECT_REPOSITORY_CACHE=", StringComparison.Ordinal));
    [Fact] void should_not_supply_repository_authentication() => _result.Env.ShouldNotContain(value => value.StartsWith("GITHUB_TOKEN=", StringComparison.Ordinal) || value.StartsWith("GH_TOKEN=", StringComparison.Ordinal));
    [Fact] void should_preserve_other_environment() => _result.Env.ShouldContain("UNCHANGED=value");
    [Fact] void should_not_keep_the_caller_container_path() => _result.Env.ShouldNotContain("CRATIS_WORKSPACE_PATH=/caller-path");
}
