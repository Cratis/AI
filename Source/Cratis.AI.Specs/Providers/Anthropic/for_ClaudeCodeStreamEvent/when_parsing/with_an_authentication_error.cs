// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_an_authentication_error : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","error":"authentication_failed","message":{"content":[{"type":"text","text":"API Error: 401 {\"error\":{\"type\":\"authentication_error\",\"message\":\"Invalid credential\"}}"}]}}""", out _event);

    [Fact] void should_recognize_the_failure() => _recognized.ShouldBeTrue();

    [Fact] void should_classify_the_credential_refusal() => _event.FailureKind.ShouldEqual(ClaudeCodeFailureKind.Authentication);
    [Fact] void should_carry_the_vendor_code() => _event.FailureReason!.ShouldContain("authentication_failed");
    [Fact] void should_carry_the_http_status() => _event.FailureReason!.ShouldContain("HTTP 401");
    [Fact] void should_explain_the_recovery() => _event.FailureReason!.ShouldContain("the subscription credential was rejected; sign in again");
    [Fact] void should_carry_the_api_error_type() => _event.FailureReason!.ShouldContain("authentication_error");
    [Fact] void should_carry_the_api_message() => _event.FailureReason!.ShouldContain("Invalid credential");
}
