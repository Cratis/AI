// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class with_retries_before_initialization : given.a_substitute_process
{
    ChatResponse _response = null!;

    void Establish() => Produces(
        "not json",
        """{"type":"system","subtype":"api_retry","error_status":503}""",
        """{"type":"system","subtype":"init","session_id":"session-1"}""",
        """{"type":"stream_event","event":{"delta":{"type":"text_delta","text":"Oslo"}}}""",
        """{"type":"result","subtype":"success","session_id":"session-2","result":"Oslo"}""");

    async Task Because() => _response = await _client.GetResponseAsync(_messages);

    [Fact] void should_keep_the_initial_session_id() => _response.ResponseId.ShouldEqual("session-1");
    [Fact] void should_not_duplicate_streamed_text() => _response.Text.ShouldEqual("Oslo");
}
