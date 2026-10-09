// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_init_reports_an_mcp_server_error : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"system","subtype":"init","session_id":"abc-123","mcp_server_errors":[{"name":"cratis","type":"connection_error","message":"secret-token-password"}]}""", out _event);

    [Fact] void should_recognize_the_line() => _recognized.ShouldBeTrue();
    [Fact] void should_report_a_failure() => _event.IsFailure.ShouldBeTrue();
    [Fact] void should_not_expose_vendor_diagnostics() => _event.FailureReason!.Contains("secret-token-password", StringComparison.Ordinal).ShouldBeFalse();
}
