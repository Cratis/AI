// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_an_assistant_api_error : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","error":"authentication_failed","message":{"role":"assistant","content":[{"type":"text","text":"secret-token-password"}]}}""", out _event);

    [Fact] void should_recognize_the_failure() => _recognized.ShouldBeTrue();
    [Fact] void should_classify_the_api_failure() => _event.FailureKind.ShouldEqual(ClaudeCodeFailureKind.ModelRequest);
    [Fact] void should_fail_the_turn() => _event.IsFailure.ShouldBeTrue();
    [Fact] void should_not_expose_diagnostics() => _event.FailureReason!.Contains("secret-token-password", StringComparison.Ordinal).ShouldBeFalse();
}
