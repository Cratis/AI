// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_calling_a_tool;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_malformed_arguments : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 1, method = "tools/call", @params = new { name = "echo", arguments = new[] { "secret" } } });

    [Fact] void should_reject_invalid_parameters() => _response.GetProperty("error").GetProperty("code").GetInt32().ShouldEqual(-32602);
    [Fact] void should_never_invoke_the_tool() => _lastSeenArgument.ShouldBeNull();
}
