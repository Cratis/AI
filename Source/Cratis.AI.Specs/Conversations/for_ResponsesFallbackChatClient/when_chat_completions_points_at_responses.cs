// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_ResponsesFallbackChatClient;

public class when_chat_completions_points_at_responses : given.two_clients
{
    ChatResponse _first;
    ChatResponse _second;

    void Establish() => _chatCompletions
        .GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
        .Returns(Task.FromException<ChatResponse>(new InvalidOperationException(PointedAtResponses)));

    async Task Because()
    {
        _first = await _client.GetResponseAsync(Hello());
        _second = await _client.GetResponseAsync(Hello());
    }

    [Fact] void should_answer_the_refused_call_from_responses() => _first.Text.ShouldEqual("from responses");
    [Fact] void should_answer_the_next_call_from_responses() => _second.Text.ShouldEqual("from responses");
    [Fact] void should_try_chat_completions_only_once() => _chatCompletions.Received(1).GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>());
    [Fact] void should_build_the_responses_client_once() => _responsesClientsBuilt.ShouldEqual(1);
    [Fact] void should_say_it_uses_responses() => _client.UsesResponses.ShouldBeTrue();
}
