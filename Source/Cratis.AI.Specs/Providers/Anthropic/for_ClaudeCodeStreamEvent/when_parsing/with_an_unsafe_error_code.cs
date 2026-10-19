// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_an_unsafe_error_code : Specification
{
    ClaudeCodeStreamEvent _event = null!;

    void Because() => ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","error":"sk-ant-private-credential\nprivate diagnostic"}""", out _event);

    [Fact] void should_use_the_unknown_code() => _event.FailureReason!.ShouldContain("unknown");
    [Fact] void should_not_echo_the_untrusted_code() => _event.FailureReason!.Contains("private", StringComparison.Ordinal).ShouldBeFalse();
    [Fact] void should_remain_a_model_request_failure() => _event.FailureKind.ShouldEqual(ClaudeCodeFailureKind.ModelRequest);
}
