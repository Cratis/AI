// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.given;

public class a_chat_with_a_failing_access_lookup : a_pooled_chat_client
{
    void Establish()
    {
        _options.Value.MaxConcurrency = 1;
        _options.Value.MaxConcurrencyWaitTimeout = TimeSpan.Zero;
        var id = AIProviderId.New();
        AgentNamesProvider(id);
        var provider = new ConfiguredAIProvider(id, AIProviderType.Anthropic, "test")
        {
            AvailableModels = PublishedCatalogs.For(AIProviderType.Anthropic)
        };
        var reads = 0;

        // Configuration and initial access resolve normally; the fresh lookup while holding the slot fails.
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(_ => ++reads == 3
            ? Task.FromException<ConfiguredAIProvider>(new TimeoutException("access lookup failed"))
            : Task.FromResult(provider));
        _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "served")));
    }
}
