// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class and_the_line_is_a_non_init_system_message : Specification
{
    bool _recognized;
    ClaudeCodeStreamEvent _event = null!;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"system","subtype":"compact_boundary"}""", out _event);

    [Fact] void should_not_recognize_the_line() => _recognized.ShouldBeFalse();
}
