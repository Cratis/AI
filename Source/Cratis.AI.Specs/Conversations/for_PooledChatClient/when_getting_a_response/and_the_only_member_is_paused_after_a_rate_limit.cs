// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Capacity;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

/// <summary>
/// A provider parked after its vendor turned work away is skipped before any call, and the failure says in plain
/// words that it is paused, until when, and how to lift it - not only that it "has no capacity".
/// </summary>
public class and_the_only_member_is_paused_after_a_rate_limit : given.a_pooled_chat_client
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _member = AIProviderId.New();

    Exception _exception;

    void Establish()
    {
        AgentDrawsFromPool(_pool);
        PoolIs(_pool, _member);
        ProviderIs(_member, AIProviderType.Anthropic);

        var now = DateTimeOffset.UtcNow;
        var paused = AIProviderCapacityCalculator.Compute(_member, AIProviderCapacitySource.Unknown, [], null, now, now.AddMinutes(20), now, 0.02);
        _capacities.ForMany(Arg.Any<IReadOnlyCollection<AIProviderId>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<AIProviderId, AIProviderCapacity> { [_member] = paused });
    }

    async Task Because() => _exception = await Catch.Exception(() => _client.GetResponseAsync([new(ChatRole.User, "hello")]));

    [Fact] void should_fail() => _exception.ShouldBeOfExactType<AIChatClientUnavailable>();

    [Fact] void should_say_the_provider_is_paused() => _exception.Message.ShouldContain("is paused until");

    [Fact] void should_say_how_to_lift_the_pause() => _exception.Message.ShouldContain("Settings > AI");

    [Fact] void should_not_say_it_has_no_capacity() => _exception.Message.ShouldNotContain("has no capacity");

    [Fact] void should_not_call_the_provider() => _anthropicChat.DidNotReceive().GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>());
}
