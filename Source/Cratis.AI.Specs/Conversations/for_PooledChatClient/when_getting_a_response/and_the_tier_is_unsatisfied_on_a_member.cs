// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_the_tier_is_unsatisfied_on_a_member : given.a_pooled_chat_client
{
    readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    readonly AIProviderId _first = AIProviderId.New();
    readonly AIProviderId _second = AIProviderId.New();
    ChatResponse _response;

    void Establish()
    {
        AgentDrawsFromPool(_pool);
        PoolIs(_pool, _first, _second);
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_first).Returns(new ConfiguredAIProvider(_first, AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-sonnet-4-5")]
        });
        ProviderIs(_second, AIProviderType.OpenAI);
        _openAIChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "from-openai")));
    }

    async Task Because() => _response = await _client.GetResponseAsync([new(ChatRole.User, "hi")]);

    [Fact] void should_answer_from_the_next_member() => _response.Text.ShouldEqual("from-openai");
    [Fact] async Task should_not_construct_a_client_for_the_refused_member() => await _factory.DidNotReceive().Create(Arg.Is<ConfiguredAIProvider>(provider => provider.Id == _first), Arg.Any<ModelName>());
    [Fact] void should_not_remember_a_vendor_failure() => _failures.DidNotReceive().Record(_first);
    [Fact] void should_not_record_a_rate_limit() => _commandPipeline.ReceivedCalls().ShouldBeEmpty();
}
