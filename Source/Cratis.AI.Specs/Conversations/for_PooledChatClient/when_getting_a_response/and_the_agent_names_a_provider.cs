// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Usage;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_the_agent_names_a_provider : given.a_pooled_chat_client
{
    static readonly AIProviderId _provider = AIProviderId.New();

    ChatResponse _response;

    void Establish()
    {
        AgentNamesProvider(_provider);
        ProviderIs(_provider, AIProviderType.Anthropic);
        _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "hello")) { Usage = new UsageDetails { InputTokenCount = 10, OutputTokenCount = 5 } });
    }

    async Task Because() => _response = await _client.GetResponseAsync([new(ChatRole.User, "hi")]);

    [Fact] void should_return_the_providers_answer() => _response.Text.ShouldEqual("hello");

    [Fact]
    void should_record_the_usage() =>
        _commandPipeline.Received(1).Execute(Arg.Is<RecordAgentSessionUsage>(command =>
            command.InputTokens == new InputTokens(10) &&
            command.OutputTokens == new OutputTokens(5)));
}
