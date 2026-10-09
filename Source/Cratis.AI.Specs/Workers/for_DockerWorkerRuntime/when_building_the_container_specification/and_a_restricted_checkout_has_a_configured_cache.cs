// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class and_a_restricted_checkout_has_a_configured_cache : Specification
{
    CreateContainerParameters _result;
    CreateContainerParameters _emptyContract;

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
        _result = DockerWorkerRuntime.BuildContainerSpecification(job, "/repos", "CUSTOM_CACHE");
        environment["DIRECT_REPOSITORY_CHECKOUTS"] = string.Empty;
        _emptyContract = DockerWorkerRuntime.BuildContainerSpecification(job, "/repos", "CUSTOM_CACHE");
    }

    [Fact] void should_omit_the_shared_cache() => _result.HostConfig.Binds.ShouldBeEmpty();
    [Fact] void should_omit_cache_environment_even_if_supplied_by_the_caller() => _result.Env.ShouldNotContain(variable => variable.StartsWith("CUSTOM_CACHE=", StringComparison.Ordinal) || variable.StartsWith("DIRECT_REPOSITORY_CACHE=", StringComparison.Ordinal));
    [Fact] void should_preserve_other_environment() => _result.Env.ShouldContain("UNCHANGED=value");
    [Fact] void should_omit_the_cache_for_an_empty_contract() => _emptyContract.HostConfig.Binds.ShouldBeEmpty();
}
