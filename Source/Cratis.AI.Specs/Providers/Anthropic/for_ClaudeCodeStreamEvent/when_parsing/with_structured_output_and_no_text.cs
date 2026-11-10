// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_structured_output_and_no_text : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"result","subtype":"success","is_error":false,"structured_output":{"answer":42}}""",
        out _event);

    [Fact] void should_recognize_the_result() => _recognized.ShouldBeTrue();
    [Fact] void should_not_report_a_failure() => _event.IsFailure.ShouldBeFalse();
    [Fact] void should_report_structured_output() => _event.HasStructuredOutput.ShouldBeTrue();
    [Fact] void should_preserve_the_structured_json() => _event.ResultText.ShouldEqual("""{"answer":42}""");
}
