// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Text.Json;
using Docker.DotNet.Models;

namespace Planner.Work.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

/// <summary>
/// The acceptance criterion from issue #86, asserted against the serialized specification rather
/// than against the object model: "No credential appears in <c>docker inspect</c>". Serializing is
/// what makes this a real check - it sees every field, including any a future edit adds without
/// thinking about it.
/// </summary>
public class and_the_work_has_credentials : Specification
{
    const string _oauthToken = "sk-ant-secret-value";
    const string _callbackToken = "callback-secret-value";
    const string _gitHubToken = "ghs-secret-value";

    CreateContainerParameters _result;
    string _serialized;

    void Because()
    {
        _result = DockerWorkerRuntime.BuildContainerSpecification(new WorkerJob(
            WorkId.New(),
            "cratis/planner-worker:latest",
            new Dictionary<string, string> { ["PLANNER_MODEL"] = "opus" },
            new Dictionary<string, string>
            {
                ["CLAUDE_CODE_OAUTH_TOKEN"] = _oauthToken,
                ["PLANNER_CALLBACK_TOKEN"] = _callbackToken,
                ["GITHUB_TOKEN"] = _gitHubToken
            }));
        _serialized = JsonSerializer.Serialize(_result);
    }

    [Fact] void should_not_expose_the_account_token() => _serialized.ShouldNotContain(_oauthToken);
    [Fact] void should_not_expose_the_callback_token() => _serialized.ShouldNotContain(_callbackToken);
    [Fact] void should_not_expose_the_github_token() => _serialized.ShouldNotContain(_gitHubToken);

    [Fact] void should_still_carry_the_non_secret_configuration() => _result.Env.ShouldContain("PLANNER_MODEL=opus");

    [Fact]
    void should_tell_the_entrypoint_where_to_read_them() =>
        _result.Env.ShouldContain($"{WorkerSecrets.PathVariableName}={WorkerSecrets.Path}");

    [Fact]
    void should_keep_them_off_the_writable_layer() =>
        _result.HostConfig.Tmpfs.ContainsKey(WorkerSecrets.Directory).ShouldBeTrue();
}
#endif
