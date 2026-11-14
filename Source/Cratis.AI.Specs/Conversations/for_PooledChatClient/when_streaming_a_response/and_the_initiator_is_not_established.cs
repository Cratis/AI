// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_streaming_a_response;

public class and_the_initiator_is_not_established : given.a_restricted_provider
{
    Exception _error;

    async Task Because()
    {
        _error = await Catch.Exception(async () =>
        {
            await foreach (var update in _client.GetStreamingResponseAsync([new(ChatRole.User, "hi")]))
            {
                _ = update;
            }
        });
    }

    [Fact] void should_deny_unattributed_work() => _error.ShouldBeOfExactType<AIChatClientUnavailable>();
    [Fact] async Task should_not_construct_a_vendor_client() => await _factory.DidNotReceiveWithAnyArgs().Create(default!, default!);
}
