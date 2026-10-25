// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class with_a_streamed_stop_reason : given.a_substitute_process
{
    ChatResponse _response = null!;

    void Establish() => Produces(
        """{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"max_tokens","stop_sequence":null}}}""",
        """{"type":"result","subtype":"success","result":"partial answer"}""");

    async Task Because() => _response = await _client.GetResponseAsync(_messages);

    [Fact] void should_report_the_actual_stop_reason() => _response.FinishReason.ShouldEqual(ChatFinishReason.Length);
}
