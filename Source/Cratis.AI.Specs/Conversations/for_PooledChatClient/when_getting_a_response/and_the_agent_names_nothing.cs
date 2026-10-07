// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_the_agent_names_nothing : given.a_pooled_chat_client
{
    Exception _exception;

    async Task Because() => _exception = await Catch.Exception(() => _client.GetResponseAsync([new(ChatRole.User, "hi")]));

    [Fact] void should_say_nothing_could_serve_it() => _exception.ShouldBeOfExactType<AIChatClientUnavailable>();
}
