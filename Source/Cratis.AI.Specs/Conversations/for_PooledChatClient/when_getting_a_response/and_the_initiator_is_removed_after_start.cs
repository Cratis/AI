// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_the_initiator_is_removed_after_start : given.a_restricted_provider
{
    ChatResponse _first;
    Exception _error;

    void Establish() => _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions?>(), Arg.Any<CancellationToken>())
        .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "from-anthropic")));

    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"alice"));
        _first = await _client.GetResponseAsync([new(ChatRole.User, "first")]);
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_provider)
            .Returns(_restricted with { AllowedTeamMembers = [] });
        _error = await Catch.Exception(() => _client.GetResponseAsync([new(ChatRole.User, "second")]));
    }

    [Fact] void should_allow_the_first_dispatch() => _first.Text.ShouldEqual("from-anthropic");
    [Fact] void should_deny_the_next_dispatch_in_the_same_journey() => _error.ShouldBeOfExactType<AIChatClientUnavailable>();
    [Fact] async Task should_construct_a_vendor_client_only_once() => await _factory.ReceivedWithAnyArgs(1).Create(default!, default!);
}
