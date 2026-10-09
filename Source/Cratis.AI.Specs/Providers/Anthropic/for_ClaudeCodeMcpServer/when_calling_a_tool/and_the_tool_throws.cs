// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_calling_a_tool;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_the_tool_throws : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 4, method = "tools/call", @params = new { name = "failing", arguments = new { } } });

    [Fact] void should_report_the_call_as_failed() => _response.GetProperty("result").GetProperty("isError").GetBoolean().ShouldBeTrue();
    [Fact] void should_not_expose_the_secret_bearing_exception() => _response.GetRawText().Contains("secret-token-password", StringComparison.Ordinal).ShouldBeFalse();
    [Fact] void should_still_answer_with_a_jsonrpc_result_not_an_error_envelope() => _response.TryGetProperty("error", out _).ShouldBeFalse();
}
