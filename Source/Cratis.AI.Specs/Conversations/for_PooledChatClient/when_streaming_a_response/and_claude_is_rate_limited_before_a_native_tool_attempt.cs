// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_streaming_a_response;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_claude_is_rate_limited_before_a_native_tool_attempt : given.a_native_claude_rate_limit
{
    void Establish() => _invokeTool = false;

    Task Because() => Respond(true);

    [Fact] void should_fail_over() => _text.ShouldEqual("fallback");
    [Fact] void should_not_invoke_a_tool() => _attempts.ShouldEqual(0);
    [Fact] void should_leave_replay_safe() => _failure.FunctionInvocationAttempted.ShouldBeFalse();
    [Fact] void should_not_fail() => _error.ShouldBeNull();
}
