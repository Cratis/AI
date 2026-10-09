// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class and_the_conversation_succeeds : given.a_substitute_process
{
    ChatResponse _response = null!;

    void Establish() => Produces(
        """{"type":"system","subtype":"init","session_id":"session-1"}""",
        """{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Oslo"}}}""",
        """{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"."}}}""",
        """{"type":"result","subtype":"success","is_error":false,"session_id":"session-1","result":"Oslo.","usage":{"input_tokens":10,"output_tokens":2},"modelUsage":{"claude-sonnet-4-6":{}}}""");

    async Task Because() => _response = await _client.GetResponseAsync(_messages);

    [Fact] void should_assemble_the_streamed_text() => _response.Text.ShouldEqual("Oslo.");
    [Fact] void should_report_the_session_as_the_response_id() => _response.ResponseId.ShouldEqual("session-1");
    [Fact] void should_report_the_model_that_actually_answered() => _response.ModelId.ShouldEqual("claude-sonnet-4-6");
    [Fact] void should_report_input_tokens() => _response.Usage!.InputTokenCount.ShouldEqual(10);
    [Fact] void should_report_output_tokens() => _response.Usage!.OutputTokenCount.ShouldEqual(2);
    [Fact] void should_finish_with_stop() => _response.FinishReason.ShouldEqual(ChatFinishReason.Stop);
}
