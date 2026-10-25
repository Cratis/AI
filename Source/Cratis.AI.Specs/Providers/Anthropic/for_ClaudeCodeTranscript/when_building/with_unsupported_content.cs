// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeTranscript.when_building;

public class with_unsupported_content : Specification
{
    Exception? _error;

    void Because() => _error = Catch.Exception(() => ClaudeCodeTranscript.Build([new ChatMessage(ChatRole.User, [new UriContent(new Uri("https://example.com/image.png"), "image/png")])], null));

    [Fact] void should_reject_rather_than_drop_the_content() => _error.ShouldBeOfExactType<ClaudeCodeConversationFailed>();
}
