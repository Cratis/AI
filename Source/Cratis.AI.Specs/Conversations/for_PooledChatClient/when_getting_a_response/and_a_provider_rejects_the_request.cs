// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_a_provider_rejects_the_request : given.a_pooled_chat_client
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    Exception _exception;

    void Establish()
    {
        AgentDrawsFromPool(_pool);
        PoolIs(_pool, _first, _second);
        ProviderIs(_first, AIProviderType.Anthropic);
        ProviderIs(_second, AIProviderType.OpenAI);

        _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns<ChatResponse>(_ => throw new InvalidOperationException("bad request"));
        _openAIChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "from-openai")));
    }

    async Task Because() => _exception = await Catch.Exception(() => _client.GetResponseAsync([new(ChatRole.User, "hi")]));

    [Fact] void should_fail() => _exception.ShouldBeOfExactType<AIChatClientUnavailable>();

    [Fact]
    void should_not_try_the_rest_of_the_pool() =>
        _openAIChat.DidNotReceive().GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>());
}
