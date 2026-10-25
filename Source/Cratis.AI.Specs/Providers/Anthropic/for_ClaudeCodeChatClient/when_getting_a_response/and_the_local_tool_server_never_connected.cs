// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class and_the_local_tool_server_never_connected : given.a_substitute_process
{
    Exception? _error;

    void Establish() => Produces(
        """{"type":"system","subtype":"init","session_id":"session-1","mcp_server_errors":{"cratis":"timed out"}}""",
        """{"type":"result","subtype":"success","is_error":false,"session_id":"session-1","result":"should never be read"}""");

    async Task Because() => _error = await Catch.Exception(() => _client.GetResponseAsync(_messages));

    [Fact] void should_fail_before_reading_any_further_output() => _error.ShouldBeOfExactType<ClaudeCodeConversationFailed>();
    [Fact] void should_explain_the_tool_server_did_not_connect() => _error!.Message.Contains("tool server").ShouldBeTrue();
}
