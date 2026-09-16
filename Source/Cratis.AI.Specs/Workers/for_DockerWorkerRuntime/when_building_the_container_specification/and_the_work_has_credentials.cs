// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Usage;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

/// <summary>
/// "No credential appears in <c>docker inspect</c>", asserted against the serialized specification
/// rather than against the object model - serializing is what makes this a real check, since it sees
/// every field, including any a future edit adds without thinking about it.
/// </summary>
public class and_the_work_has_credentials : Specification
{
    const string OauthToken = "sk-ant-secret-value";
    const string CallbackToken = "callback-secret-value";
    const string GitHubToken = "ghs-secret-value";

    CreateContainerParameters _result;
    string _serialized;

    void Because()
    {
        _result = DockerWorkerRuntime.BuildContainerSpecification(new WorkerJob(
            AgentSessionId.New(),
            "cratis/ai-agents-claude:latest",
            new Dictionary<string, string> { ["DIRECT_MODEL"] = "opus" },
            new Dictionary<string, string>
            {
                ["CLAUDE_CODE_OAUTH_TOKEN"] = OauthToken,
                ["DIRECT_CALLBACK_TOKEN"] = CallbackToken,
                ["GITHUB_TOKEN"] = GitHubToken
            }));
        _serialized = JsonSerializer.Serialize(_result);
    }

    [Fact] void should_not_expose_the_account_token() => _serialized.ShouldNotContain(OauthToken);
    [Fact] void should_not_expose_the_callback_token() => _serialized.ShouldNotContain(CallbackToken);
    [Fact] void should_not_expose_the_github_token() => _serialized.ShouldNotContain(GitHubToken);

    [Fact] void should_still_carry_the_non_secret_configuration() => _result.Env.ShouldContain("DIRECT_MODEL=opus");

    [Fact]
    void should_tell_the_entrypoint_where_to_read_them() =>
        _result.Env.ShouldContain($"{WorkerSecrets.PathVariableName}={WorkerSecrets.Path}");

    [Fact]
    void should_keep_them_off_the_writable_layer() =>
        _result.HostConfig.Tmpfs.ContainsKey(WorkerSecrets.Directory).ShouldBeTrue();
}
