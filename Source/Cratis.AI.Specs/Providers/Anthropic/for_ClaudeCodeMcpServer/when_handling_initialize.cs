// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class when_handling_initialize : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 1, method = "initialize", @params = new { protocolVersion = "2025-06-18", capabilities = new { }, clientInfo = new { name = "specs", version = "1" } } });

    [Fact] void should_echo_the_requested_protocol_version() => _response.GetProperty("result").GetProperty("protocolVersion").GetString().ShouldEqual("2025-06-18");
    [Fact] void should_name_itself() => _response.GetProperty("result").GetProperty("serverInfo").GetProperty("name").GetString().ShouldEqual("cratis");
    [Fact] void should_advertise_tool_support() => _response.GetProperty("result").TryGetProperty("capabilities", out _).ShouldBeTrue();
}
