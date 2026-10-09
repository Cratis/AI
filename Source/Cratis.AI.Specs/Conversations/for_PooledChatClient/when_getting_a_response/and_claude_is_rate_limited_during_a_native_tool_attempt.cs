// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_claude_is_rate_limited_during_a_native_tool_attempt : given.a_native_claude_rate_limit
{
    void Establish() => _rateLimitDuringTool = true;
    Task Because() => Respond(false);

    [Fact] void should_stop_the_pool() => _error.ShouldBeOfExactType<AIChatClientUnavailable>();
    [Fact] void should_not_try_the_second_member() => SecondMemberWasNotCreated();
    [Fact] void should_mark_replay_unsafe() => _failure.FunctionInvocationAttempted.ShouldBeTrue();
    [Fact] void should_attempt_the_function_once() => _attempts.ShouldEqual(1);
    [Fact] void should_drain_the_inflight_function() => _toolDrained.ShouldBeTrue();
    [Fact] void should_preserve_the_rate_limit_classification() => _failure.Kind.ShouldEqual(ClaudeCodeFailureKind.RateLimit);
    [Fact] void should_release_the_slot() => _slot.Received(1).Dispose();
    [Fact] void should_dispose_the_client() => _anthropicChat.Received(1).Dispose();
}
