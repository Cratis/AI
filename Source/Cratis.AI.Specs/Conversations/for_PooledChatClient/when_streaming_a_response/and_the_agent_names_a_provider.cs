// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Usage;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_streaming_a_response;

public class and_the_agent_names_a_provider : given.a_pooled_chat_client
{
    static readonly AIProviderId _provider = AIProviderId.New();

    List<ChatResponseUpdate> _updates;

    void Establish()
    {
        AgentNamesProvider(_provider);
        ProviderIs(_provider, AIProviderType.Anthropic);
        _anthropicChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => Stream());
    }

    async Task Because()
    {
        _updates = [];
        await foreach (var update in _client.GetStreamingResponseAsync([new(ChatRole.User, "hi")]))
        {
            _updates.Add(update);
        }
    }

    [Fact] void should_yield_every_update() => _updates.Count.ShouldEqual(3);

    [Fact]
    void should_record_the_usage() =>
        _commandPipeline.Received(1).Execute(Arg.Is<RecordAgentSessionUsage>(command =>
            command.InputTokens == new InputTokens(3) &&
            command.OutputTokens == new OutputTokens(2)));

    static async IAsyncEnumerable<ChatResponseUpdate> Stream()
    {
        yield return new ChatResponseUpdate(ChatRole.Assistant, "he");
        yield return new ChatResponseUpdate(ChatRole.Assistant, "llo");
        yield return new ChatResponseUpdate { Contents = [new UsageContent(new UsageDetails { InputTokenCount = 3, OutputTokenCount = 2 })] };
        await Task.CompletedTask;
    }
}
