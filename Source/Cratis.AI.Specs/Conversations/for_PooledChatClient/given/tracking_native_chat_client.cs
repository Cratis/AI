// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.given;

public sealed class tracking_native_chat_client(IChatClient native) : IChatClient
{
    public Exception? Error { get; private set; }

    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        try
        {
            return await native.GetResponseAsync(messages, options, cancellationToken);
        }
        catch (Exception error)
        {
            Error = error;
            throw;
        }
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await using var updates = native.GetStreamingResponseAsync(messages, options, cancellationToken).GetAsyncEnumerator(cancellationToken);
        while (await MoveNext(updates)) yield return updates.Current;
    }

    public object? GetService(Type serviceType, object? serviceKey = null) => native.GetService(serviceType, serviceKey);

    public void Dispose() => native.Dispose();

    async Task<bool> MoveNext(IAsyncEnumerator<ChatResponseUpdate> updates)
    {
        try
        {
            return await updates.MoveNextAsync();
        }
        catch (Exception error)
        {
            Error = error;
            throw;
        }
    }
}
