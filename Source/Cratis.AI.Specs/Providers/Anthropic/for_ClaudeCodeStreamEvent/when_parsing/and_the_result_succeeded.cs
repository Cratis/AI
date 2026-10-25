// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_result_succeeded : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"result","subtype":"success","is_error":false,"session_id":"abc-123","result":"Oslo.","usage":{"input_tokens":12,"output_tokens":3,"cache_read_input_tokens":5},"total_cost_usd":0.002,"modelUsage":{"claude-sonnet-4-6":{"inputTokens":12,"outputTokens":3,"cacheReadInputTokens":5}}}""",
        out _event);

    [Fact] void should_recognize_the_line() => _recognized.ShouldBeTrue();
    [Fact] void should_report_it_as_a_result() => _event.IsResult.ShouldBeTrue();
    [Fact] void should_not_report_a_failure() => _event.IsFailure.ShouldBeFalse();
    [Fact] void should_capture_the_session_id() => _event.SessionId.ShouldEqual("abc-123");
    [Fact] void should_capture_the_model_that_actually_answered() => _event.ModelId.ShouldEqual("claude-sonnet-4-6");
    [Fact] void should_capture_input_tokens() => _event.Usage!.InputTokenCount.ShouldEqual(17);
    [Fact] void should_capture_output_tokens() => _event.Usage!.OutputTokenCount.ShouldEqual(3);
    [Fact] void should_capture_cached_tokens() => _event.Usage!.CachedInputTokenCount.ShouldEqual(5);
    [Fact] void should_capture_the_cost() => _event.CostUsd.ShouldEqual(0.002m);
}
