// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class with_a_response_schema : given.a_substitute_process
{
    ProcessStartInfo _info = null!;
    ChatResponse _response = null!;

    void Establish()
    {
        Produces(
            """{"type":"stream_event","event":{"delta":{"type":"text_delta","text":"intermediate prose"}}}""",
            """{"type":"result","subtype":"success","result":"prose","structured_output":{"answer":"Oslo"}}""");
        _process.When(process => process.Run(Arg.Any<ProcessStartInfo>(), Arg.Any<string>(), Arg.Any<CancellationToken>())).Do(call => _info = call.Arg<ProcessStartInfo>());
    }

    async Task Because()
    {
        using var schema = JsonDocument.Parse("""{"type":"object","properties":{"answer":{"type":"string"}},"required":["answer"]}""");
        _response = await _client.GetResponseAsync(_messages, new ChatOptions { ResponseFormat = ChatResponseFormat.ForJsonSchema(schema.RootElement) });
    }

    [Fact] void should_pass_the_schema_to_the_cli() => _info.ArgumentList.ShouldContain("--json-schema");
    [Fact] void should_return_only_the_structured_result() => _response.Text.ShouldEqual("""{"answer":"Oslo"}""");
}
