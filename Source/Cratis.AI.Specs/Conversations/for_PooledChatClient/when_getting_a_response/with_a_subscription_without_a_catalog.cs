// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class with_a_subscription_without_a_catalog : given.a_subscription_without_a_catalog
{
    ChatResponse _response;

    void Establish() => _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
        .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "hello")));

    async Task Because() => _response = await _client.GetResponseAsync([new(ChatRole.User, "hi")]);

    [Fact] void should_return_the_subscription_answer() => _response.Text.ShouldEqual("hello");
    [Fact] void should_resolve_the_balanced_cli_alias() => _factory.Received(1).Create(Arg.Is<ConfiguredAIProvider>(provider => provider.Id == Subscription), (ModelName)"sonnet");
}
