// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeTranscript.when_building;

public class and_there_is_nothing_to_say_as_a_system_prompt : Specification
{
    (string? SystemPrompt, string Transcript) _result;

    void Because() => _result = ClaudeCodeTranscript.Build([new ChatMessage(ChatRole.User, "Hi")], null);

    [Fact] void should_report_no_system_prompt() => _result.SystemPrompt.ShouldBeNull();
}
