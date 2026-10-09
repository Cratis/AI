// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_the_native_transport_fails_after_a_function_attempt_and_text : given.a_native_claude_rate_limit
{
    void Establish()
    {
        _rateLimitDuringTool = true;
        _emitText = true;
        _transportError = new IOException("429 private diagnostic sentinel");
    }

    Task Because() => Respond(false);

    [Fact] void should_stop_the_pool() => _error.ShouldBeOfExactType<AIChatClientUnavailable>();
    [Fact] void should_wrap_the_native_failure() => _nativeChat.Error.ShouldBeOfExactType<ClaudeCodeConversationFailed>();
    [Fact] void should_mark_the_actual_function_attempt_as_replay_unsafe() => ((ClaudeCodeConversationFailed)_nativeChat.Error!).FunctionInvocationAttempted.ShouldBeTrue();
    [Fact] void should_not_classify_private_diagnostics_as_a_rate_limit() => ((ClaudeCodeConversationFailed)_nativeChat.Error!).Kind.ShouldEqual(ClaudeCodeFailureKind.Conversation);
    [Fact] void should_sanitize_the_native_failure() => _nativeChat.Error!.ToString().ShouldNotContain("429 private diagnostic sentinel");
    [Fact] void should_not_expose_private_diagnostics_to_the_caller() => _error!.ToString().ShouldNotContain("429 private diagnostic sentinel");
    [Fact] void should_not_try_the_second_member() => SecondMemberWasNotCreated();
    [Fact] void should_attempt_the_real_function_once() => _attempts.ShouldEqual(1);
    [Fact] void should_drain_the_inflight_function() => _toolDrained.ShouldBeTrue();
    [Fact] void should_release_the_functions_resources() => _functionResource.Received(1).Dispose();
    [Fact] void should_release_the_slot() => _slot.Received(1).Dispose();
    [Fact] void should_dispose_the_client() => _anthropicChat.Received(1).Dispose();
    [Fact] void should_return_no_partial_response() => _text.ShouldEqual("");
    [Fact] void should_remove_the_temporary_directory() => Directory.Exists(_startInfo.WorkingDirectory).ShouldBeFalse();
}
