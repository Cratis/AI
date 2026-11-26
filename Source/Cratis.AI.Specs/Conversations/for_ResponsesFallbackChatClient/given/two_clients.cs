// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_ResponsesFallbackChatClient.given;

public class two_clients : Specification
{
    public const string PointedAtResponses = "HTTP 400 (invalid_request_error: )\nParameter: reasoning_effort\n\nFunction tools with reasoning_effort are not supported for gpt-6.2-sol in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.";

    protected IChatClient _chatCompletions;
    protected IChatClient _responses;
    protected int _responsesClientsBuilt;
    protected ResponsesFallbackChatClient _client;

    void Establish()
    {
        _chatCompletions = Substitute.For<IChatClient>();
        _responses = Substitute.For<IChatClient>();
        _responses
            .GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "from responses")));
        _client = new(_chatCompletions, () =>
        {
            _responsesClientsBuilt++;
            return _responses;
        });
    }

    protected static List<ChatMessage> Hello() => [new ChatMessage(ChatRole.User, "hi")];
}
