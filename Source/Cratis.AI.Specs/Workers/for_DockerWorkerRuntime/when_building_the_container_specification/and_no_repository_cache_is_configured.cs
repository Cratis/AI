// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

/// <summary>
/// No repository-cache path configured - the specification must come out with no bind mount and no
/// repository-cache environment variable, whether the parameters are omitted entirely or passed as
/// explicit <see langword="null"/>/empty values.
/// </summary>
public class and_no_repository_cache_is_configured : Specification
{
    static WorkerJob Job() => new(AgentSessionId.New(), "cratis/ai-agents-claude:latest", new Dictionary<string, string>(), new Dictionary<string, string>());

    CreateContainerParameters _omitted;
    CreateContainerParameters _explicitNull;
    CreateContainerParameters _explicitEmpty;

    void Because()
    {
        var job = Job();
        _omitted = DockerWorkerRuntime.BuildContainerSpecification(job);
        _explicitNull = DockerWorkerRuntime.BuildContainerSpecification(job, null, null);
        _explicitEmpty = DockerWorkerRuntime.BuildContainerSpecification(job, string.Empty, string.Empty);
    }

    [Fact]
    void should_not_bind_mount_anything() => _omitted.HostConfig.Binds.ShouldBeEmpty();

    [Fact]
    void should_not_set_any_repository_cache_environment_variable() =>
        _omitted.Env.ShouldNotContain(variable => variable.Contains("REPOSITORY_CACHE=", StringComparison.Ordinal));

    [Fact]
    void should_be_the_same_whether_omitted_or_explicitly_null() =>
        _explicitNull.Env.ShouldContainOnly(_omitted.Env);

    [Fact]
    void should_be_the_same_whether_omitted_or_explicitly_empty() =>
        _explicitEmpty.Env.ShouldContainOnly(_omitted.Env);
}
