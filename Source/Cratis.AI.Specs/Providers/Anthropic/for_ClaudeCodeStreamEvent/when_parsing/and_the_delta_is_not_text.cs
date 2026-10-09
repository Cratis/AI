// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_delta_is_not_text : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{}"}}}""", out _event);

    [Fact] void should_not_recognize_the_line() => _recognized.ShouldBeFalse();
}
