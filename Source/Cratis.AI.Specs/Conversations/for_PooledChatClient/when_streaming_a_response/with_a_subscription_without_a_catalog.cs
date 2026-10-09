// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_streaming_a_response;

public class with_a_subscription_without_a_catalog : given.a_subscription_without_a_catalog
{
    List<ChatResponseUpdate> _updates;

    void Establish() => _anthropicChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
        .Returns(_ => Stream());

    async Task Because()
    {
        _updates = [];
        await foreach (var update in _client.GetStreamingResponseAsync([new(ChatRole.User, "hi")]))
        {
            _updates.Add(update);
        }
    }

    [Fact] void should_return_the_subscription_answer() => _updates.Single().Text.ShouldEqual("hello");
    [Fact] void should_resolve_the_balanced_cli_alias() => _factory.Received(1).Create(Arg.Is<ConfiguredAIProvider>(provider => provider.Id == Subscription), (ModelName)"sonnet");

    static async IAsyncEnumerable<ChatResponseUpdate> Stream()
    {
        yield return new ChatResponseUpdate(ChatRole.Assistant, "hello");
        await Task.CompletedTask;
    }
}
