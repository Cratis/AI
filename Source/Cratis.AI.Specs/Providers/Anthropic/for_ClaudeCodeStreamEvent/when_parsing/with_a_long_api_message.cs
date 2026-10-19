// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_a_long_api_message : Specification
{
    ClaudeCodeStreamEvent _event = null!;

    void Because()
    {
        var detail = JsonSerializer.Serialize(new { error = new { type = "invalid_request_error", message = string.Concat(Enumerable.Repeat("model unavailable ", 100)) } });
        var line = JsonSerializer.Serialize(new
        {
            type = "assistant",
            error = "invalid_request",
            message = new { content = new[] { new { type = "text", text = $"API Error: 400 {detail}" } } }
        });
        ClaudeCodeStreamEvent.TryParse(line, out _event);
    }

    [Fact] void should_bound_the_details_to_two_hundred_characters() => _event.FailureReason!.Split("; the request or model was refused: ", StringSplitOptions.None)[1].Length.ShouldEqual(201);
    [Fact] void should_mark_truncation() => _event.FailureReason!.EndsWith("....", StringComparison.Ordinal).ShouldBeTrue();
    [Fact] void should_keep_the_status() => _event.FailureReason!.ShouldContain("HTTP 400");
}
