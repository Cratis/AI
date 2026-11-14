// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class with_reserved_environment : Specification
{
    CreateContainerParameters _result;

    void Because()
    {
        var environment = new Dictionary<string, string>
        {
            ["direct_secrets_file"] = "untrusted",
            ["DIRECT_SECRETS_FILE=untrusted"] = "untrusted",
            ["CRATIS_WORKER_REQUIRE_SECRETS"] = "false",
            ["direct_prompt_file"] = "untrusted",
            ["direct_prompt"] = "untrusted",
            ["direct_repository_cache"] = "untrusted",
            ["custom_cache"] = "untrusted",
            ["UNCHANGED"] = "value"
        };
        _result = DockerWorkerRuntime.BuildContainerSpecification(new WorkerJob(AgentSessionId.New(), "image", environment, new Dictionary<string, string>()), "/repos", "CUSTOM_CACHE");
    }

    [Fact] void should_filter_reserved_names_case_insensitively() => _result.Env.ShouldNotContain(value => value.Contains("untrusted", StringComparison.Ordinal));
    [Fact] void should_require_delivery() => _result.Env.ShouldContain($"{WorkerSecrets.RequiredVariableName}=true");
    [Fact] void should_use_the_runtime_secret_path() => _result.Env.ShouldContain($"{WorkerSecrets.PathVariableName}={WorkerSecrets.Path}");
    [Fact] void should_use_the_runtime_prompt_path() => _result.Env.ShouldContain($"{WorkerPromptFile.PathVariableName}={WorkerPromptFile.Path}");
    [Fact] void should_not_expose_an_unrequested_cache() => _result.Env.ShouldNotContain("CUSTOM_CACHE=/repos");
    [Fact] void should_preserve_non_reserved_environment() => _result.Env.ShouldContain("UNCHANGED=value");
}
