// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_tools_are_provided : given.a_substitute_process
{
    ProcessStartInfo _startInfo = null!;
    ChatResponse _response = null!;
    string? _argument;
    string? _toolResult;

    void Establish() => _process.Run(Arg.Any<ProcessStartInfo>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
        .Returns(call => RunChild(call.Arg<ProcessStartInfo>()));

    async Task Because()
    {
        var tool = AIFunctionFactory.Create(
            (string text) =>
            {
                _argument = text;
                return $"echo:{text}";
            },
            "echo",
            "Echoes text.");
        _response = await _client.GetResponseAsync(_messages, new ChatOptions { Tools = [tool] });
    }

    [Fact] void should_answer() => _response.Text.ShouldEqual("done");
    [Fact] void should_route_arguments_to_the_callers_real_function() => _argument.ShouldEqual("hello");
    [Fact] void should_return_the_function_result_to_the_child() => _toolResult.ShouldEqual("echo:hello");
    [Fact] void should_allow_that_tool_by_name() => _startInfo.ArgumentList.ShouldContain("--allowedTools");
    [Fact] void should_remove_the_temporary_working_directory_afterwards() => Directory.Exists(_startInfo.WorkingDirectory).ShouldBeFalse();

    async IAsyncEnumerable<string> RunChild(ProcessStartInfo info)
    {
        _startInfo = info;
        using var config = JsonDocument.Parse(await File.ReadAllTextAsync(info.ArgumentList[info.ArgumentList.IndexOf("--mcp-config") + 1]));
        var server = config.RootElement.GetProperty("mcpServers").GetProperty("cratis");
        using var http = new HttpClient();
        http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", server.GetProperty("headers").GetProperty("Authorization").GetString());
        using var initialize = await http.PostAsJsonAsync(server.GetProperty("url").GetString(), new
        {
            jsonrpc = "2.0", id = 1, method = "initialize",
            @params = new { protocolVersion = "2025-06-18", capabilities = new { }, clientInfo = new { name = "child", version = "1" } },
        });
        initialize.EnsureSuccessStatusCode();
        yield return """{"type":"system","subtype":"init","session_id":"session-1","mcp_servers":[{"name":"cratis","status":"connected"}]}""";
        using var response = await http.PostAsJsonAsync(server.GetProperty("url").GetString(), new { jsonrpc = "2.0", id = 2, method = "tools/call", @params = new { name = "echo", arguments = new { text = "hello" } } });
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        _toolResult = result.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString();
        yield return """{"type":"result","subtype":"success","is_error":false,"session_id":"session-1","result":"done"}""";
    }
}
