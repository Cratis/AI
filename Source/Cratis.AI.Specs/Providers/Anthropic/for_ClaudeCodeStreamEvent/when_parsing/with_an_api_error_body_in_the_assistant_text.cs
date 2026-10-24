// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

/// <summary>
/// The CLI echoes the vendor's API error body in the assistant text; the vendor's own message in it says what it
/// objected to, so it is kept - redacted and bounded - in the reason.
/// </summary>
public class with_an_api_error_body_in_the_assistant_text : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"assistant","error":"invalid_request","message":{"role":"assistant","content":[{"type":"text","text":"API Error: 400 {\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"tools.3.custom.input_schema: JSON schema is invalid. Used key sk-ant-oat01-abcdefghijklmnopqrstuvwxyz0123456789\"},\"request_id\":\"req_1\"}"}]}}""",
        out _event);

    [Fact] void should_recognize_the_failure() => _recognized.ShouldBeTrue();
    [Fact] void should_classify_the_failure_as_invalid() => _event.FailureKind.ShouldEqual(ClaudeCodeFailureKind.InvalidRequest);
    [Fact] void should_say_what_the_vendor_objected_to() => _event.FailureReason.ShouldContain("tools.3.custom.input_schema: JSON schema is invalid");
    [Fact] void should_not_expose_a_credential_the_vendor_echoed() => _event.FailureReason!.Contains("abcdefghijklmnopqrstuvwxyz", StringComparison.Ordinal).ShouldBeFalse();
}
