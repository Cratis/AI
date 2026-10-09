// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class when_handling_an_unknown_method : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 6, method = "not/a/real/method" });

    [Fact] void should_answer_with_a_jsonrpc_error() => _response.TryGetProperty("error", out _).ShouldBeTrue();
    [Fact] void should_use_the_method_not_found_code() => _response.GetProperty("error").GetProperty("code").GetInt32().ShouldEqual(-32601);
}
