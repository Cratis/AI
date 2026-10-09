// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_a_pool_member_fails_transiently : given.a_pooled_chat_client
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    ChatResponse _response;

    void Establish()
    {
        AgentDrawsFromPool(_pool);
        PoolIs(_pool, _first, _second);
        ProviderIs(_first, AIProviderType.Anthropic);
        ProviderIs(_second, AIProviderType.OpenAI);

        _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns<ChatResponse>(_ => throw new HttpRequestException("busy", null, System.Net.HttpStatusCode.ServiceUnavailable));
        _openAIChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "from-openai")));
    }

    async Task Because() => _response = await _client.GetResponseAsync([new(ChatRole.User, "hi")]);

    [Fact] void should_answer_from_the_surviving_member() => _response.Text.ShouldEqual("from-openai");
    [Fact] void should_remember_the_failure_against_the_failed_member() => _failures.Received(1).Record(_first);
}
