// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_line_is_a_partial_text_delta : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Oslo"}}}""", out _event);

    [Fact] void should_recognize_the_line() => _recognized.ShouldBeTrue();
    [Fact] void should_report_it_as_partial_text() => _event.IsPartialText.ShouldBeTrue();
    [Fact] void should_capture_the_delta_text() => _event.DeltaText.ShouldEqual("Oslo");
}
