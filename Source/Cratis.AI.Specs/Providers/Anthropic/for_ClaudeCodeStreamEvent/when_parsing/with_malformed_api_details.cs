// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_malformed_api_details : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","error":"invalid_request","message":{"content":[{"type":"text","text":"API Error: 400 {private malformed diagnostic"}]}}""", out _event);

    [Fact] void should_recognize_the_failure() => _recognized.ShouldBeTrue();

    [Fact] void should_keep_the_status() => _event.FailureReason!.ShouldContain("HTTP 400");
    [Fact] void should_keep_the_code() => _event.FailureReason!.ShouldContain("invalid_request");
    [Fact] void should_withhold_the_malformed_diagnostic() => _event.FailureReason!.Contains("private malformed diagnostic", StringComparison.Ordinal).ShouldBeFalse();
}
