// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_a_billing_error : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","error":"billing_error"}""", out _event);

    [Fact] void should_recognize_the_failure() => _recognized.ShouldBeTrue();

    [Fact] void should_be_a_failure() => _event.IsFailure.ShouldBeTrue();
    [Fact] void should_classify_the_failure() => _event.FailureKind.ShouldEqual(ClaudeCodeFailureKind.Billing);
    [Fact] void should_carry_the_vendor_code() => _event.FailureReason!.ShouldContain("billing_error");
    [Fact] void should_explain_the_failure() => _event.FailureReason!.ShouldContain("the plan or credit is exhausted");
}
