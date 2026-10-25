// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_a_directory_cleanup_failure : given.a_substitute_process
{
    string _directory = null!;
    Uri _endpoint = null!;
    Exception? _error;
    bool _connected;

    void Establish() => _process.Run(Arg.Any<ProcessStartInfo>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
        .Returns(call => Child(call.Arg<ProcessStartInfo>()));

    async Task Because()
    {
        _error = await Catch.Exception(() => _client.GetResponseAsync(_messages, new ChatOptions { Tools = [AIFunctionFactory.Create(() => "done", "tool")] }));
        using var socket = new TcpClient();
        var connectionError = await Catch.Exception(async () => await socket.ConnectAsync(_endpoint.Host, _endpoint.Port).WaitAsync(TimeSpan.FromSeconds(5)));
        _connected = connectionError is null;
    }

    [Fact] void should_report_the_cleanup_failure() => _error.ShouldNotBeNull();
    [Fact] void should_still_dispose_the_tool_server() => _connected.ShouldBeFalse();

    async IAsyncEnumerable<string> Child(ProcessStartInfo info)
    {
        _directory = info.WorkingDirectory;
        using var config = JsonDocument.Parse(await File.ReadAllTextAsync(info.ArgumentList[info.ArgumentList.IndexOf("--mcp-config") + 1]));
        _endpoint = new(config.RootElement.GetProperty("mcpServers").GetProperty("cratis").GetProperty("url").GetString()!);
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(_directory, UnixFileMode.UserRead | UnixFileMode.UserExecute);
        yield return """{"type":"system","subtype":"init","mcp_servers":[{"name":"cratis","status":"connected"}]}""";
        yield return """{"type":"result","subtype":"success","result":"done"}""";
    }

    void Destroy()
    {
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(_directory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        Directory.Delete(_directory, recursive: true);
    }
}
