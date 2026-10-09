// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_a_rejected_rate_limit_event : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","rateLimitType":"five_hour","resetsAt":1790000000},"message":"secret-token-password"}""", out _event);

    [Fact] void should_recognize_the_event() => _recognized.ShouldBeTrue();
    [Fact] void should_classify_the_limit_without_parsing_diagnostics() => _event.FailureKind.ShouldEqual(ClaudeCodeFailureKind.RateLimit);
    [Fact] void should_fail_the_turn() => _event.IsFailure.ShouldBeTrue();
    [Fact] void should_not_expose_diagnostics() => _event.FailureReason!.Contains("secret-token-password", StringComparison.Ordinal).ShouldBeFalse();
}
