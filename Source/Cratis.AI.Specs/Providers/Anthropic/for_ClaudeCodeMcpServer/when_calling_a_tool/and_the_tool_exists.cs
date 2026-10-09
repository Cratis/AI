// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_calling_a_tool;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_the_tool_exists : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 3, method = "tools/call", @params = new { name = "echo", arguments = new { text = "hello" } } });

    [Fact] void should_actually_invoke_the_function() => _lastSeenArgument.ShouldEqual("hello");
    [Fact] void should_not_report_an_error() => _response.GetProperty("result").GetProperty("isError").GetBoolean().ShouldBeFalse();
    [Fact] void should_return_the_functions_result_as_text() => _response.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString().ShouldEqual("echo:hello");
}
