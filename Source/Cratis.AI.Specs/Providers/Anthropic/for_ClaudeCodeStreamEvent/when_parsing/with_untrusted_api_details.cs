// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_untrusted_api_details : Specification
{
    const string Credential = "sk-ant-private-test-credential";
    const string Bearer = "private-bearer-value";
    const string LongToken = "0123456789abcdef0123456789abcdef";
    ClaudeCodeStreamEvent _event = null!;

    void Because()
    {
        var detail = JsonSerializer.Serialize(new
        {
            error = new { type = "authentication_error", message = $"Invalid {Credential} Bearer {Bearer} {LongToken}\n\tPlease sign in. {new string('x', 250)}" },
            request = "raw request sentinel",
            stderr = "private stderr sentinel"
        });
        var line = JsonSerializer.Serialize(new
        {
            type = "assistant",
            error = "authentication_failed",
            message = new { content = new[] { new { type = "text", text = $"API Error: 401 {detail}" } } }
        });
        ClaudeCodeStreamEvent.TryParse(line, out _event);
    }

    [Fact] void should_keep_the_useful_description() => _event.FailureReason!.ShouldContain("Please sign in.");
    [Fact] void should_redact_the_credential() => _event.FailureReason!.Contains(Credential, StringComparison.Ordinal).ShouldBeFalse();
    [Fact] void should_redact_the_bearer() => _event.FailureReason!.Contains(Bearer, StringComparison.Ordinal).ShouldBeFalse();
    [Fact] void should_redact_the_long_token() => _event.FailureReason!.Contains(LongToken, StringComparison.Ordinal).ShouldBeFalse();
    [Fact] void should_mark_redactions() => _event.FailureReason!.ShouldContain("[redacted]");
    [Fact] void should_not_include_the_request() => _event.FailureReason!.Contains("raw request sentinel", StringComparison.Ordinal).ShouldBeFalse();
    [Fact] void should_not_include_stderr() => _event.FailureReason!.Contains("private stderr sentinel", StringComparison.Ordinal).ShouldBeFalse();
    [Fact] void should_be_a_single_printable_line() => _event.FailureReason!.All(character => character is >= ' ' and <= '~').ShouldBeTrue();
}
