// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_streaming_a_response;

public class and_a_pool_member_fails_before_answering : given.a_pooled_chat_client
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    string _text;

    void Establish()
    {
        AgentDrawsFromPool(_pool);
        PoolIs(_pool, _first, _second);
        ProviderIs(_first, AIProviderType.Anthropic);
        ProviderIs(_second, AIProviderType.OpenAI);

        _anthropicChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => Failing());
        _openAIChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => Working());
    }

    async Task Because()
    {
        _text = string.Empty;
        await foreach (var update in _client.GetStreamingResponseAsync([new(ChatRole.User, "hi")]))
        {
            _text += update.Text;
        }
    }

    [Fact] void should_stream_from_the_surviving_member() => _text.ShouldEqual("from-openai");

    static async IAsyncEnumerable<ChatResponseUpdate> Failing()
    {
        await Task.CompletedTask;
        throw new HttpRequestException("busy", null, System.Net.HttpStatusCode.ServiceUnavailable);
#pragma warning disable CS0162
        yield break;
#pragma warning restore CS0162
    }

    static async IAsyncEnumerable<ChatResponseUpdate> Working()
    {
        await Task.CompletedTask;
        yield return new ChatResponseUpdate(ChatRole.Assistant, "from-openai");
    }
}
