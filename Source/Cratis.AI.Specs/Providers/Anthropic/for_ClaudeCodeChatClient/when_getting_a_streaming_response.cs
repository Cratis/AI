// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient;

public class when_getting_a_streaming_response : when_getting_a_response.given.a_substitute_process
{
    readonly List<ChatResponseUpdate> _updates = [];

    void Establish() => Produces(
        """{"type":"system","subtype":"init","session_id":"session-1"}""",
        """{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Oslo"}}}""",
        """{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"."}}}""",
        """{"type":"result","subtype":"success","is_error":false,"session_id":"session-1","result":"Oslo."}""");

    async Task Because()
    {
        await foreach (var update in _client.GetStreamingResponseAsync(_messages))
        {
            _updates.Add(update);
        }
    }

    [Fact] void should_yield_one_update_per_text_delta_plus_a_final_one() => _updates.Count.ShouldEqual(3);
    [Fact] void should_yield_the_first_delta_as_it_arrives() => _updates[0].Text.ShouldEqual("Oslo");
    [Fact] void should_yield_the_second_delta_as_it_arrives() => _updates[1].Text.ShouldEqual(".");
    [Fact] void should_finish_the_stream_with_stop() => _updates[^1].FinishReason.ShouldEqual(ChatFinishReason.Stop);
}
