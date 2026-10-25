// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class without_the_expected_server_connected : given.a_substitute_process
{
    Exception? _error;

    void Establish() => Produces(
        """{"type":"system","subtype":"init","mcp_servers":[{"name":"unrelated","status":"connected"},{"name":"cratis","status":"failed"}]}""",
        """{"type":"result","subtype":"success","result":"done"}""");

    async Task Because() => _error = await Catch.Exception(() => _client.GetResponseAsync(_messages, new ChatOptions { Tools = [AIFunctionFactory.Create(() => "done", "tool")] }));

    [Fact] void should_refuse_a_success_without_the_callers_tool_route() => _error.ShouldBeOfExactType<ClaudeCodeConversationFailed>();
}
