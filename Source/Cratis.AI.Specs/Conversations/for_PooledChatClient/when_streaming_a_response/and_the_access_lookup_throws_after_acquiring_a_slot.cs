// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_streaming_a_response;

public class and_the_access_lookup_throws_after_acquiring_a_slot : given.a_chat_with_a_failing_access_lookup
{
    Exception _firstError;
    Exception _secondError;
    List<ChatResponseUpdate> _updates;

    static async IAsyncEnumerable<ChatResponseUpdate> Stream()
    {
        yield return new ChatResponseUpdate(ChatRole.Assistant, "served");
        await Task.CompletedTask;
    }

    void Establish()
    {
        _updates = [];
        _anthropicChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => Stream());
    }

    async Task Because()
    {
        _firstError = await Catch.Exception(ReadResponse);
        _secondError = await Catch.Exception(ReadResponse);
    }

    async Task ReadResponse()
    {
        await foreach (var update in _client.GetStreamingResponseAsync([new(ChatRole.User, "hi")]))
        {
            _updates.Add(update);
        }
    }

    [Fact] void should_preserve_the_lookup_failure() => _firstError.ShouldBeOfExactType<TimeoutException>();
    [Fact] void should_release_the_slot_for_the_next_call() => _secondError.ShouldBeNull();
    [Fact] void should_serve_the_next_call() => _updates.Count.ShouldEqual(1);
}
