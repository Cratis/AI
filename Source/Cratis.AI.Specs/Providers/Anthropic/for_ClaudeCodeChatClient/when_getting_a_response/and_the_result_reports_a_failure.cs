// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class and_the_result_reports_a_failure : given.a_substitute_process
{
    Exception? _error;

    void Establish() => Produces(
        """{"type":"system","subtype":"init","session_id":"session-1"}""",
        """{"type":"result","subtype":"success","is_error":true,"session_id":"session-1","result":""}""");

    async Task Because() => _error = await Catch.Exception(() => _client.GetResponseAsync(_messages));

    [Fact] void should_fail() => _error.ShouldBeOfExactType<ClaudeCodeConversationFailed>();
}
