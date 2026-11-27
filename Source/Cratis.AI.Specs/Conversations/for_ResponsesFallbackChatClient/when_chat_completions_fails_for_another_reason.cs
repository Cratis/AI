// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_ResponsesFallbackChatClient;

public class when_chat_completions_fails_for_another_reason : given.two_clients
{
    Exception _exception;

    void Establish() => _chatCompletions
        .GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
        .Returns(Task.FromException<ChatResponse>(new InvalidOperationException("HTTP 429 (rate_limit_exceeded)")));

    async Task Because() => _exception = await Catch.Exception(async () => await _client.GetResponseAsync(Hello()));

    [Fact] void should_leave_the_failure_alone() => _exception.Message.ShouldContain("429");
    [Fact] void should_not_build_the_responses_client() => _responsesClientsBuilt.ShouldEqual(0);
}
