// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_mixed_assistant_error_content : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"assistant","error":"invalid_request","message":{"content":[null,{"text":42},{"text":"untrusted answer"},{"text":"API Error: 400 {\"error\":{\"message\":\"Vendor detail\"}}"}]}}""", out _event);

    [Fact] void should_recognize_the_failure() => _recognized.ShouldBeTrue();
    [Fact] void should_use_only_the_vendor_detail() => _event.FailureReason!.Contains("Vendor detail", StringComparison.Ordinal).ShouldBeTrue();
    [Fact] void should_not_forward_model_text() => _event.FailureReason!.Contains("untrusted answer", StringComparison.Ordinal).ShouldBeFalse();
}
