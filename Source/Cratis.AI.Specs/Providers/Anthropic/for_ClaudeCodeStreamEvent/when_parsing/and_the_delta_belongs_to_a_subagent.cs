// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_delta_belongs_to_a_subagent : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"stream_event","parent_tool_use_id":"tool-1","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Oslo"}}}""", out _event);

    [Fact] void should_not_recognize_the_line() => _recognized.ShouldBeFalse();
}
