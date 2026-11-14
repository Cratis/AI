// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_the_initiator_is_excluded : given.a_restricted_provider
{
    Exception _error;

    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"bob"));
        _error = await Catch.Exception(() => _client.GetResponseAsync([new(ChatRole.User, "hi")]));
    }

    [Fact] void should_deny() => _error.ShouldBeOfExactType<AIChatClientUnavailable>();
    [Fact] void should_explain_access() => _error.Message.ShouldContain("work initiator");
    [Fact] async Task should_not_construct_a_vendor_client() => await _factory.DidNotReceiveWithAnyArgs().Create(default!, default!);
}
