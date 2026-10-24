// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_TemperatureOmittingChatClient.when_sending_a_request;

public abstract class given_a_recording_client : Specification
{
    protected ChatOptions? _received;
    protected ChatOptions _sent;
    protected TemperatureOmittingChatClient _client;

    void Establish()
    {
        var inner = Substitute.For<IChatClient>();
        inner.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Do<ChatOptions?>(options => _received = options), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new ChatResponse()));
        _client = new TemperatureOmittingChatClient(inner, "claude-sonnet-5-5");
        _sent = new ChatOptions { Temperature = 0.2f };
    }

    protected Task Send() => _client.GetResponseAsync([], _sent);
}
