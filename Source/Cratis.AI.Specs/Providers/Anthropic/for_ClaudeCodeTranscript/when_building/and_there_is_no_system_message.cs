// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeTranscript.when_building;

public class and_there_is_no_system_message : Specification
{
    (string? SystemPrompt, string Transcript) _result;

    void Because() => _result = ClaudeCodeTranscript.Build([new ChatMessage(ChatRole.User, "Hi")], "Reply in French.");

    [Fact] void should_use_the_instructions_as_the_whole_system_prompt() => _result.SystemPrompt.ShouldEqual("Reply in French.");
}
