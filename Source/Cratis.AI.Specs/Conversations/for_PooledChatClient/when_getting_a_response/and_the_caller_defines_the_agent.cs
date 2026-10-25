// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_the_caller_defines_the_agent : given.a_pooled_chat_client
{
    static readonly AIProviderId _provider = AIProviderId.New();

    ChatResponse _response;

    void Establish()
    {
        ProviderIs(_provider, AIProviderType.OpenAI);
        _openAIChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "from-target")));
        var target = new Agents.Listing.Agent(Agents.AgentId.For((LanguageModels.LanguageModelPurpose)Purpose), Purpose, "Own", "Own agent.", ModelTier.Balanced, _provider, null);
        _client = new(
            (LanguageModels.LanguageModelPurpose)Purpose,
            _readModels,
            _compatibility,
            _burn,
            _usageLevels,
            _capacities,
            _failures,
            new ProviderConcurrencyGate(_options),
            _factory,
            _agents,
            _execution,
            _commandPipeline,
            _recorder,
            TimeProvider.System,
            _options,
            Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance,
            target);
    }

    async Task Because() => _response = await _client.GetResponseAsync([new(ChatRole.User, "hi")]);

    [Fact] void should_serve_from_the_target_without_any_configured_agent() => _response.Text.ShouldEqual("from-target");
}
