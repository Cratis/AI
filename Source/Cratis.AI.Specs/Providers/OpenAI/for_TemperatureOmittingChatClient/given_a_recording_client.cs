// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.OpenAI.for_TemperatureOmittingChatClient;

public abstract class given_a_recording_client : Specification
{
    protected ChatOptions? _received;
    protected ChatOptions _sent;
    protected IChatClient _inner;

    void Establish()
    {
        _inner = Substitute.For<IChatClient>();
        _inner.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Do<ChatOptions?>(options => _received = options), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse());
        _inner.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Do<ChatOptions?>(options => _received = options), Arg.Any<CancellationToken>())
            .Returns(AsyncEnumerable.Empty<ChatResponseUpdate>());
        _sent = new ChatOptions { Temperature = 0.2f };
    }
}
