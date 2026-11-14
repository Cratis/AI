// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_the_access_lookup_throws_after_acquiring_a_slot : given.a_chat_with_a_failing_access_lookup
{
    Exception _firstError;
    Exception _secondError;
    ChatResponse _response;

    async Task Because()
    {
        _firstError = await Catch.Exception(() => _client.GetResponseAsync([new(ChatRole.User, "first")]));
        _secondError = await Catch.Exception(async () => _response = await _client.GetResponseAsync([new(ChatRole.User, "second")]));
    }

    [Fact] void should_preserve_the_lookup_failure() => _firstError.ShouldBeOfExactType<TimeoutException>();
    [Fact] void should_release_the_slot_for_the_next_call() => _secondError.ShouldBeNull();
    [Fact] void should_serve_the_next_call() => _response.Text.ShouldEqual("served");
}
