// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_an_assistant_error_code_that_is_not_known : Specification
{
    ClaudeCodeStreamEvent _unknown = null!;
    ClaudeCodeStreamEvent _freeText = null!;

    bool _recognized = true;

    void Because()
    {
        _recognized &= ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","error":"something_new","message":{"role":"assistant","content":[]}}""", out _unknown);
        _recognized &= ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","error":"Bearer sk-ant-oat01-leak, please run /login","message":{"role":"assistant","content":[]}}""", out _freeText);
    }

    [Fact] void should_recognize_every_line() => _recognized.ShouldBeTrue();
    [Fact] void should_classify_an_unknown_code_as_a_model_request_failure() => _unknown.FailureKind.ShouldEqual(ClaudeCodeFailureKind.ModelRequest);
    [Fact] void should_name_the_unknown_code() => _unknown.FailureReason!.ShouldContain("something_new");
    [Fact] void should_drop_a_code_that_is_free_text() => _freeText.FailureCode.ShouldBeNull();
    [Fact] void should_not_repeat_free_text() => _freeText.FailureReason!.Contains("sk-ant", StringComparison.Ordinal).ShouldBeFalse();
}
