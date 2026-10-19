// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_claude_refuses_the_credential_after_a_tool_attempt : given.a_claude_model_refusal
{
    Exception? _error;

    void Establish() => _functionInvocationAttempted = true;

    async Task Because() => _error = await Catch.Exception(Respond);

    [Fact] void should_fail_the_turn() => _error.ShouldNotBeNull();
    [Fact] void should_not_create_the_next_member() => _factory.DidNotReceive().Create(Arg.Is<ConfiguredAIProvider>(provider => provider.Id == _second), Arg.Any<ModelName>());
}
