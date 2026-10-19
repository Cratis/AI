// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Anthropic;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_no_members_claude_token_is_accepted : given.a_pooled_chat_client
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _provider = AIProviderId.New();

    Exception _exception;

    void Establish()
    {
        AgentDrawsFromPool(_pool);
        PoolIs(_pool, _provider);
        ProviderIs(_provider, AIProviderType.Anthropic);

        _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns<ChatResponse>(_ => throw new ClaudeCodeConversationFailed(ClaudeCodeFailureText.For(ClaudeCodeFailureKind.Authentication, "authentication_failed", 401), kind: ClaudeCodeFailureKind.Authentication));
    }

    async Task Because() => _exception = await Catch.Exception(() => _client.GetResponseAsync([new(ChatRole.User, "hi")]));

    [Fact] void should_fail_as_unavailable() => _exception.ShouldBeOfExactType<AIChatClientUnavailable>();
    [Fact] void should_carry_the_reason_on_its_own() => ((AIChatClientUnavailable)_exception).Reason.ShouldContain("authentication_failed");
    [Fact] void should_name_the_provider() => _exception.Message.ShouldContain(_provider.Value.ToString());
    [Fact] void should_name_the_vendor_type() => _exception.Message.ShouldContain("Anthropic");
    [Fact] void should_name_the_model() => _exception.Message.ShouldContain("model ");
    [Fact] void should_name_the_code() => _exception.Message.ShouldContain("authentication_failed");
    [Fact] void should_name_the_status() => _exception.Message.ShouldContain("HTTP 401");
}
