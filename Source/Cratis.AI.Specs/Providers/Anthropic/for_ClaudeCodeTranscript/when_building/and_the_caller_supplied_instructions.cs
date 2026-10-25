// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeTranscript.when_building;

public class and_the_caller_supplied_instructions : given.a_full_conversation
{
    void Because() => _result = ClaudeCodeTranscript.Build(_messages, "Reply in French.");

    [Fact] void should_append_the_instructions_after_the_system_messages() => _result.SystemPrompt.ShouldEqual("You are terse.\n\nReply in French.");
}
