// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_the_named_providers_tier_is_unsatisfied : given.a_pooled_chat_client
{
    readonly AIProviderId _provider = AIProviderId.New();
    Exception _error;

    void Establish()
    {
        AgentNamesProvider(_provider);
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_provider).Returns(new ConfiguredAIProvider(_provider, AIProviderType.Anthropic, "sk-ant-test")
        {
            TierModels = new(ModelName.NotSet, "retired-sonnet", ModelName.NotSet, ModelName.NotSet),
            AvailableModels = [new("claude-sonnet-4-5")]
        });
    }

    async Task Because() => _error = await Catch.Exception(() => _client.GetResponseAsync([new(ChatRole.User, "hi")]));

    [Fact] void should_fail_with_an_unavailable_client() => _error.ShouldBeOfExactType<AIChatClientUnavailable>();
    [Fact] void should_name_the_missing_model() => _error.Message.ShouldContain("retired-sonnet");
    [Fact] void should_name_the_tier() => _error.Message.ShouldContain("Balanced");
    [Fact] void should_name_the_provider() => _error.Message.ShouldContain(_provider.Value.ToString());
    [Fact] async Task should_not_construct_a_vendor_client() => await _factory.DidNotReceive().Create(Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>());
}
