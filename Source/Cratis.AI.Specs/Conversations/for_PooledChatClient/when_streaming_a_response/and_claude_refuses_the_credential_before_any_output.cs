// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_streaming_a_response;

public class and_claude_refuses_the_credential_before_any_output : given.a_claude_model_refusal
{
    string _text = string.Empty;

    async Task Because()
    {
        await foreach (var update in _client.GetStreamingResponseAsync([new(ChatRole.User, "hello")]))
        {
            _text += update.Text;
        }
    }

    [Fact] void should_answer_from_the_next_member() => _text.ShouldEqual("fallback");
    [Fact] void should_remember_the_failed_member() => _failures.Received(1).Record(_first);
}
