// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_calling_a_tool;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_the_tool_is_unknown : given.a_running_server
{
    JsonElement _response;

    async Task Because() => _response = await Call(new { jsonrpc = "2.0", id = 5, method = "tools/call", @params = new { name = "not-a-real-tool", arguments = new { } } });

    [Fact] void should_report_the_call_as_failed() => _response.GetProperty("error").GetProperty("code").GetInt32().ShouldEqual(-32602);
    [Fact] void should_not_echo_untrusted_tool_names() => _response.GetRawText().Contains("not-a-real-tool", StringComparison.Ordinal).ShouldBeFalse();
}
