// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_line_is_session_startup : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"system","subtype":"init","session_id":"abc-123"}""", out _event);

    [Fact] void should_recognize_the_line() => _recognized.ShouldBeTrue();
    [Fact] void should_report_it_as_init() => _event.IsInit.ShouldBeTrue();
    [Fact] void should_not_report_a_failure() => _event.IsFailure.ShouldBeFalse();
    [Fact] void should_capture_the_session_id() => _event.SessionId.ShouldEqual("abc-123");
}
