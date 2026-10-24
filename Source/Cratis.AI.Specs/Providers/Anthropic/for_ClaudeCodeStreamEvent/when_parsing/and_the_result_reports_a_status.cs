// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_result_reports_a_status : Specification
{
    ClaudeCodeStreamEvent _unauthorized = null!;
    ClaudeCodeStreamEvent _payment = null!;
    ClaudeCodeStreamEvent _notFound = null!;
    ClaudeCodeStreamEvent _overloaded = null!;

    bool _recognized = true;

    void Because()
    {
        _recognized &= ClaudeCodeStreamEvent.TryParse("""{"type":"result","subtype":"success","is_error":true,"api_error_status":401,"result":"x","session_id":"s"}""", out _unauthorized);
        _recognized &= ClaudeCodeStreamEvent.TryParse("""{"type":"result","subtype":"success","is_error":true,"api_error_status":402,"result":"x","session_id":"s"}""", out _payment);
        _recognized &= ClaudeCodeStreamEvent.TryParse("""{"type":"result","subtype":"success","is_error":true,"api_error_status":404,"result":"x","session_id":"s"}""", out _notFound);
        _recognized &= ClaudeCodeStreamEvent.TryParse("""{"type":"result","subtype":"success","is_error":true,"api_error_status":529,"result":"x","session_id":"s"}""", out _overloaded);
    }

    [Fact] void should_recognize_every_line() => _recognized.ShouldBeTrue();
    [Fact] void should_classify_401_as_authentication() => _unauthorized.FailureKind.ShouldEqual(ClaudeCodeFailureKind.Authentication);
    [Fact] void should_classify_402_as_billing() => _payment.FailureKind.ShouldEqual(ClaudeCodeFailureKind.Billing);
    [Fact] void should_classify_404_as_an_invalid_request() => _notFound.FailureKind.ShouldEqual(ClaudeCodeFailureKind.InvalidRequest);
    [Fact] void should_classify_529_as_a_server_error() => _overloaded.FailureKind.ShouldEqual(ClaudeCodeFailureKind.ServerError);
    [Fact] void should_name_the_status() => _unauthorized.FailureReason.ShouldContain("HTTP 401");
}
