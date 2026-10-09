// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeTranscript.when_building;

public class and_there_are_no_extra_instructions : given.a_full_conversation
{
    void Because() => _result = ClaudeCodeTranscript.Build(_messages, null);

    [Fact] void should_move_the_system_message_out_of_the_transcript() => _result.SystemPrompt.ShouldEqual("You are terse.");
    [Fact] void should_not_include_the_system_message_in_the_transcript() => _result.Transcript.Contains("terse").ShouldBeFalse();
    [Fact] void should_label_user_turns() => _result.Transcript.Contains("\"role\":\"user\"").ShouldBeTrue();
    [Fact] void should_label_assistant_turns() => _result.Transcript.Contains("\"role\":\"assistant\"").ShouldBeTrue();
    [Fact] void should_label_tool_turns() => _result.Transcript.Contains("\"role\":\"tool\"").ShouldBeTrue();
    [Fact] void should_preserve_turn_order() => _result.Transcript.IndexOf("Oslo", StringComparison.Ordinal).ShouldBeLessThan(_result.Transcript.IndexOf("Sweden", StringComparison.Ordinal));
}
