// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_negotiating_protocol;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_an_unsupported_version : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 1, method = "initialize", @params = new { protocolVersion = "arbitrary-secret", capabilities = new { }, clientInfo = new { name = "spec", version = "1" } } });

    [Fact] void should_negotiate_a_supported_version() => _response.GetProperty("result").GetProperty("protocolVersion").GetString().ShouldEqual("2025-06-18");
}
