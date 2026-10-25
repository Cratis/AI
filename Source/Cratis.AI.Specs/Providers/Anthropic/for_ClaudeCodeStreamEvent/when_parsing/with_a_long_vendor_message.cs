// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

/// <summary>
/// A vendor message is bounded, so a reason never carries a page of vendor text.
/// </summary>
public class with_a_long_vendor_message : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        "{\"type\":\"assistant\",\"error\":\"invalid_request\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"API Error: 400 {\\\"error\\\":{\\\"message\\\":\\\"" + new string('x', 5000) + "\\\"}}\"}]}}",
        out _event);

    [Fact] void should_recognize_the_failure() => _recognized.ShouldBeTrue();
    [Fact] void should_keep_the_reason_short() => (_event.FailureReason!.Length < 800).ShouldBeTrue();
}
