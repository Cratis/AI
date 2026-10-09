// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_line_is_an_unmodeled_event_type : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"assistant","message":{}}""", out _event);

    [Fact] void should_not_recognize_the_line() => _recognized.ShouldBeFalse();
}
