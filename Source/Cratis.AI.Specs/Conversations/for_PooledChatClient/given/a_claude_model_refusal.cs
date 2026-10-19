// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Anthropic;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.given;

public class a_claude_model_refusal : a_pooled_chat_client
{
    protected string _code = "authentication_failed";
    protected bool _functionInvocationAttempted;
    protected AIProviderId _first;
    protected AIProviderId _second;
    protected ChatResponse _response;

    void Establish()
    {
        _first = AIProviderId.New();
        _second = AIProviderId.New();
        var pool = AIProviderPoolId.New();
        AgentDrawsFromPool(pool);
        PoolIs(pool, _first, _second);
        ProviderIs(_first, AIProviderType.Anthropic);
        ProviderIs(_second, AIProviderType.OpenAI);
        _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns<ChatResponse>(_ => throw Refusal());
        _anthropicChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => RefusedStream());
        _openAIChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "fallback")));
        _openAIChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => WorkingStream());
    }

    protected async Task Respond() => _response = await _client.GetResponseAsync([new(ChatRole.User, "hello")]);

    ClaudeCodeConversationFailed Refusal()
    {
        ClaudeCodeStreamEvent.TryParse($$"""{"type":"assistant","error":"{{_code}}"}""", out var failure);
        return new(failure.FailureReason!, kind: failure.FailureKind, functionInvocationAttempted: _functionInvocationAttempted);
    }

    async IAsyncEnumerable<ChatResponseUpdate> RefusedStream()
    {
        yield return await Task.FromException<ChatResponseUpdate>(Refusal());
    }

    static async IAsyncEnumerable<ChatResponseUpdate> WorkingStream()
    {
        await Task.CompletedTask;
        yield return new(ChatRole.Assistant, "fallback");
    }
}
