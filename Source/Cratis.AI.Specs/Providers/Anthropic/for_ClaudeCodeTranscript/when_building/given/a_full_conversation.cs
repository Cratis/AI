// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeTranscript.when_building.given;

public class a_full_conversation : Specification
{
    protected List<ChatMessage> _messages = null!;
    protected (string? SystemPrompt, string Transcript) _result;

    void Establish() => _messages =
    [
        new ChatMessage(ChatRole.System, "You are terse."),
        new ChatMessage(ChatRole.User, "What is the capital of Norway?"),
        new ChatMessage(ChatRole.Assistant, "Oslo."),
        new ChatMessage(ChatRole.Tool, "lookup(capital, Norway) = Oslo"),
        new ChatMessage(ChatRole.User, "And Sweden?"),
    ];
}
