// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Cratis.AI.Agents;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_building_start_info;

public class without_tools : Specification
{
    string _directory = null!;
    ProcessStartInfo _info = null!;

    void Establish() => _directory = Directory.CreateTempSubdirectory().FullName;

    void Because() => _info = ClaudeCodeChatClient.StartInfo(_directory, " sk-ant-oat-token \n", "claude-sonnet-4-6", Effort.High, null, null);

    [Fact] void should_stream_output_as_json() => _info.ArgumentList.ShouldContain("stream-json");
    [Fact] void should_request_partial_messages() => _info.ArgumentList.ShouldContain("--include-partial-messages");
    [Fact] void should_disable_every_built_in_tool() => _info.ArgumentList[_info.ArgumentList.IndexOf("--tools") + 1].ShouldEqual(string.Empty);
    [Fact] void should_restrict_mcp_servers_to_the_provided_config() => _info.ArgumentList.ShouldContain("--strict-mcp-config");
    [Fact] void should_configure_no_mcp_servers_at_all() => File.ReadAllText(_info.ArgumentList[_info.ArgumentList.IndexOf("--mcp-config") + 1]).ShouldEqual("{\"mcpServers\":{}}");
    [Fact] void should_not_allow_any_tool_by_name() => _info.ArgumentList.ShouldNotContain("--allowedTools");
    [Fact] void should_deny_unattended_permission_prompts() => _info.ArgumentList[_info.ArgumentList.IndexOf("--permission-prompts") + 1].ShouldEqual("none");
    [Fact] void should_never_bypass_permissions() => _info.ArgumentList.ShouldNotContain("--dangerously-skip-permissions");
    [Fact] void should_disable_session_persistence() => _info.ArgumentList.ShouldContain("--no-session-persistence");
    [Fact] void should_disable_hooks() => _info.ArgumentList.ShouldContain("{\"disableAllHooks\":true}");
    [Fact] void should_not_append_a_system_prompt() => _info.ArgumentList.ShouldNotContain("--append-system-prompt");
    [Fact] void should_keep_the_credential_out_of_arguments() => _info.ArgumentList.Any(value => value.Contains("sk-ant-oat", StringComparison.Ordinal)).ShouldBeFalse();
    [Fact] void should_remove_pasted_whitespace_from_the_credential() => _info.Environment["CLAUDE_CODE_OAUTH_TOKEN"].ShouldEqual("sk-ant-oat-token");
    [Fact] void should_not_inherit_host_secrets() => _info.Environment.Keys.Except(["PATH", "HOME", "CLAUDE_CONFIG_DIR", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"]).ShouldBeEmpty();

    void Destroy() => Directory.Delete(_directory, recursive: true);
}
