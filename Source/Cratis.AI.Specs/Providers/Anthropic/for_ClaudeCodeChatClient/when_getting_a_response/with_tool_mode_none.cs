// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class with_tool_mode_none : given.a_substitute_process
{
    ProcessStartInfo _info = null!;
    int _configuredServers;
    bool _invoked;

    void Establish() => _process.Run(Arg.Any<ProcessStartInfo>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
        .Returns(call => Child(call.Arg<ProcessStartInfo>()));

    async Task Because() => await _client.GetResponseAsync(_messages, new ChatOptions
    {
        ToolMode = ChatToolMode.None,
        Tools = [AIFunctionFactory.Create(Tool, "tool")],
        ModelId = "opus",
    });

    [Fact] void should_not_configure_a_tool_route() => _configuredServers.ShouldEqual(0);
    [Fact] void should_not_approve_tools() => _info.ArgumentList.ShouldNotContain("--allowedTools");
    [Fact] void should_not_invoke_tools() => _invoked.ShouldBeFalse();
    [Fact] void should_honor_the_requested_model() => _info.ArgumentList[_info.ArgumentList.IndexOf("--model") + 1].ShouldEqual("opus");

    string Tool()
    {
        _invoked = true;
        return "secret";
    }

    async IAsyncEnumerable<string> Child(ProcessStartInfo info)
    {
        _info = info;
        using var config = JsonDocument.Parse(await File.ReadAllTextAsync(info.ArgumentList[info.ArgumentList.IndexOf("--mcp-config") + 1]));
        _configuredServers = config.RootElement.GetProperty("mcpServers").EnumerateObject().Count();
        yield return """{"type":"result","subtype":"success","result":"done"}""";
    }
}
