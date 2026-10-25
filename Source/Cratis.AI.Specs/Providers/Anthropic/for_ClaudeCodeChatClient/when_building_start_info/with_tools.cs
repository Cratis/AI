// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Cratis.AI.Agents;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_building_start_info;

public class with_tools : Specification
{
    string _directory = null!;
    ProcessStartInfo _info = null!;
    ClaudeCodeMcpServer _server = null!;

    void Establish()
    {
        _directory = Directory.CreateTempSubdirectory().FullName;
        _server = new([], "cratis");
    }

    void Because() => _info = ClaudeCodeChatClient.StartInfo(_directory, "sk-ant-oat-token", "claude-sonnet-4-6", Effort.High, "Reply in French.", _server);

    [Fact] void should_point_the_mcp_config_at_the_servers_endpoint() => File.ReadAllText(_info.ArgumentList[_info.ArgumentList.IndexOf("--mcp-config") + 1]).Contains(_server.Endpoint.ToString(), StringComparison.Ordinal).ShouldBeTrue();
    [Fact] void should_allow_only_that_servers_tools() => _info.ArgumentList[_info.ArgumentList.IndexOf("--allowedTools") + 1].ShouldEqual("mcp__cratis__*");
    [Fact] void should_append_the_system_prompt() => _info.ArgumentList[_info.ArgumentList.IndexOf("--append-system-prompt") + 1].ShouldEqual("Reply in French.");
    [Fact] void should_keep_the_bearer_out_of_arguments() => _info.ArgumentList.Any(argument => argument.Contains(_server.Authorization, StringComparison.Ordinal)).ShouldBeFalse();
    [Fact] void should_create_owner_only_config() => (OperatingSystem.IsWindows() ? UnixFileMode.None : File.GetUnixFileMode(_info.ArgumentList[_info.ArgumentList.IndexOf("--mcp-config") + 1])).ShouldEqual(UnixFileMode.UserRead | UnixFileMode.UserWrite);
    [Fact] void should_never_bypass_permissions() => _info.ArgumentList.ShouldNotContain("--dangerously-skip-permissions");

    async Task Destroy()
    {
        await _server.DisposeAsync();
        Directory.Delete(_directory, recursive: true);
    }
}
