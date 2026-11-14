// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_initialization_is_invalid;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_a_missing_client_version : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 1, method = "initialize", @params = new { protocolVersion = "2025-06-18", capabilities = new { }, clientInfo = new { name = "specs" } } });

    [Fact] void should_reject_invalid_parameters() => _response.GetProperty("error").GetProperty("code").GetInt32().ShouldEqual(-32602);
    [Fact] void should_keep_the_error_message() => _response.GetProperty("error").GetProperty("message").GetString().ShouldEqual("Invalid initialization parameters.");
}
