// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_result_reported_an_error : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"result","subtype":"success","is_error":true,"result":"","session_id":"abc"}""", out _event);

    [Fact] void should_recognize_the_line() => _recognized.ShouldBeTrue();
    [Fact] void should_report_a_failure() => _event.IsFailure.ShouldBeTrue();
    [Fact] void should_explain_why() => _event.FailureReason.ShouldNotBeNull();
}
