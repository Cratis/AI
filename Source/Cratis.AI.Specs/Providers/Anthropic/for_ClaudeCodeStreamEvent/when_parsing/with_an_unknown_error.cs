// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_an_unknown_error : Specification
{
    ClaudeCodeStreamEvent _event = null!;

    void Because() => ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","error":"new_vendor_error"}""", out _event);

    [Fact] void should_be_a_failure() => _event.IsFailure.ShouldBeTrue();
    [Fact] void should_classify_the_failure() => _event.FailureKind.ShouldEqual(ClaudeCodeFailureKind.ModelRequest);
    [Fact] void should_carry_the_vendor_code() => _event.FailureReason!.ShouldContain("new_vendor_error");
    [Fact] void should_explain_the_failure() => _event.FailureReason!.ShouldContain("an unknown model request error occurred");
}
