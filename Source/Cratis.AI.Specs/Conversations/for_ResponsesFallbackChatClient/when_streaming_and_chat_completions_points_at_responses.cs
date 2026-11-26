// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_ResponsesFallbackChatClient;

public class when_streaming_and_chat_completions_points_at_responses : given.two_clients
{
    List<string> _text;

    void Establish()
    {
        _chatCompletions
            .GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => Refuse());
        _responses
            .GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => Stream("one", "two"));
    }

    async Task Because()
    {
        _text = [];
        await foreach (var update in _client.GetStreamingResponseAsync(Hello()))
        {
            _text.Add(update.Text);
        }
    }

    [Fact] void should_stream_from_responses() => _text.ShouldEqual(["one", "two"]);
    [Fact] void should_say_it_uses_responses() => _client.UsesResponses.ShouldBeTrue();

    static async IAsyncEnumerable<ChatResponseUpdate> Refuse()
    {
        await Task.Yield();
        throw new InvalidOperationException(PointedAtResponses);
#pragma warning disable CS0162
        yield break;
#pragma warning restore CS0162
    }

    static async IAsyncEnumerable<ChatResponseUpdate> Stream(params string[] parts)
    {
        foreach (var part in parts)
        {
            await Task.Yield();
            yield return new ChatResponseUpdate(ChatRole.Assistant, part);
        }
    }
}
