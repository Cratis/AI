// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_the_caller_cancels_after_a_native_tool_attempt : given.a_native_claude_rate_limit
{
    void Establish() => _cancelAfterTool = true;
    Task Because() => Respond(false);

    [Fact] void should_preserve_the_cancellation_identity() => _error.ShouldEqual(_cancelled);
    [Fact] void should_preserve_the_callers_token() => ((OperationCanceledException)_error!).CancellationToken.ShouldEqual(_cancellation.Token);
    [Fact] void should_not_try_the_second_member() => SecondMemberWasNotCreated();
    [Fact] void should_attempt_the_function_once() => _attempts.ShouldEqual(1);
    [Fact] void should_release_the_slot() => _slot.Received(1).Dispose();
    [Fact] void should_dispose_the_client() => _anthropicChat.Received(1).Dispose();
    [Fact] void should_remove_the_temporary_directory() => Directory.Exists(_startInfo.WorkingDirectory).ShouldBeFalse();
}
