// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class when_listing_tools : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 2, method = "tools/list" });

    [Fact] void should_list_every_provided_function() => _response.GetProperty("result").GetProperty("tools").GetArrayLength().ShouldEqual(2);
    [Fact] void should_name_the_echo_tool() => _response.GetProperty("result").GetProperty("tools").EnumerateArray().Any(tool => tool.GetProperty("name").GetString() == "echo").ShouldBeTrue();
    [Fact] void should_describe_the_echo_tool() => _response.GetProperty("result").GetProperty("tools").EnumerateArray().First(tool => tool.GetProperty("name").GetString() == "echo").GetProperty("description").GetString().ShouldEqual("Echoes the given text back.");
    [Fact] void should_carry_an_input_schema() => _response.GetProperty("result").GetProperty("tools").EnumerateArray().First(tool => tool.GetProperty("name").GetString() == "echo").TryGetProperty("inputSchema", out _).ShouldBeTrue();
}
