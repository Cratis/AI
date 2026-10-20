// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

/// <summary>
/// A failure the CLI words itself, as a message from its own synthetic model, is the CLI's text and says what was
/// refused - it is kept in the reason, unlike the text of an ordinary assistant message.
/// </summary>
public class with_the_cli_wording_of_a_failure : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse(
        """{"type":"assistant","error":"invalid_request","message":{"model":"<synthetic>","role":"assistant","content":[{"type":"text","text":"There's an issue with the selected model (haiku). It may not exist or you may not have access to it."}]}}""",
        out _event);

    [Fact] void should_recognize_the_failure() => _recognized.ShouldBeTrue();
    [Fact] void should_say_what_the_cli_said() => _event.FailureReason!.ShouldContain("There's an issue with the selected model (haiku)");
}
