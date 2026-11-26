// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_ResponsesFallbackChatClient;

public class when_chat_completions_serves_the_call : given.two_clients
{
    ChatResponse _response;

    void Establish() => _chatCompletions
        .GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
        .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "from chat completions")));

    async Task Because() => _response = await _client.GetResponseAsync(Hello());

    [Fact] void should_answer_from_chat_completions() => _response.Text.ShouldEqual("from chat completions");
    [Fact] void should_not_build_the_responses_client() => _responsesClientsBuilt.ShouldEqual(0);
    [Fact] void should_not_say_it_uses_responses() => _client.UsesResponses.ShouldBeFalse();
}
