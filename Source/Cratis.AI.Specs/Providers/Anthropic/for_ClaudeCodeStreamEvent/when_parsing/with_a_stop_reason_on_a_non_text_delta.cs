// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_a_stop_reason_on_a_non_text_delta : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"stream_event","event":{"delta":{"type":"message_delta","stop_reason":"tool_use"}}}""", out _event);

    [Fact] void should_recognize_the_line() => _recognized.ShouldBeTrue();
    [Fact] void should_report_the_stop_reason() => _event.HasStopReason.ShouldBeTrue();
    [Fact] void should_map_the_tool_stop_reason() => _event.FinishReason.ShouldEqual(ChatFinishReason.ToolCalls);
    [Fact] void should_not_forward_text() => _event.IsPartialText.ShouldBeFalse();
}
