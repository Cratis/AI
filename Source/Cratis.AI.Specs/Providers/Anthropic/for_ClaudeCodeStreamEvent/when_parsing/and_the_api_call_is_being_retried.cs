// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_api_call_is_being_retried : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"system","subtype":"api_retry","attempt":1,"max_retries":10,"retry_delay_ms":569,"error_status":401,"error":"authentication_failed","session_id":"s"}""", out _event);

    [Fact] void should_recognize_the_line() => _recognized.ShouldBeTrue();
    [Fact] void should_be_a_retry() => _event.IsRetry.ShouldBeTrue();
    [Fact] void should_not_fail_the_turn() => _event.IsFailure.ShouldBeFalse();
    [Fact] void should_carry_the_status() => _event.HttpStatus.ShouldEqual(401);
}
