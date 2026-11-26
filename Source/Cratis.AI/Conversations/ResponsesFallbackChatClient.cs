// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations;

/// <summary>
/// Serves a conversation over OpenAI's chat completions API, and over its Responses API once a model has said it cannot
/// be served by chat completions.
/// </summary>
/// <remarks>
/// Newer OpenAI models are Responses-only for what an agent needs: a model that reasons refuses function tools on
/// <c>/v1/chat/completions</c> ("Function tools with reasoning_effort are not supported ... use /v1/responses") and does not
/// accept turning reasoning off either, so no option on the chat completions request can make it work. Chat completions
/// stays the default, so every model that works there is unaffected; the Responses client is built only on the first refusal
/// that points at it, the refused call is repeated on it, and the client keeps using it for the rest of its life.
/// </remarks>
/// <param name="chatCompletions">The client that serves chat completions.</param>
/// <param name="responses">Builds the client that serves the Responses API, when it is first needed.</param>
public sealed class ResponsesFallbackChatClient(IChatClient chatCompletions, Func<IChatClient> responses) : IChatClient
{
    readonly Lock _lock = new();
    volatile IChatClient? _responses;

    /// <summary>
    /// Gets a value indicating whether the conversation has moved to the Responses API.
    /// </summary>
    public bool UsesResponses => _responses is not null;

    /// <summary>
    /// Gets whether an exception says the model has to be served by the Responses API.
    /// </summary>
    /// <param name="exception">The failure of a chat completions call.</param>
    /// <returns>True when the failure points at <c>/v1/responses</c>; otherwise false.</returns>
    public static bool IsPointedAtResponses(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current.Message.Contains("v1/responses", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    /// <inheritdoc/>
    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        var materialized = messages as IList<ChatMessage> ?? [.. messages];
        if (_responses is { } moved)
        {
            return await moved.GetResponseAsync(materialized, options, cancellationToken);
        }

        try
        {
            return await chatCompletions.GetResponseAsync(materialized, options, cancellationToken);
        }
        catch (Exception ex) when (IsPointedAtResponses(ex))
        {
            return await MoveToResponses().GetResponseAsync(materialized, options, cancellationToken);
        }
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var materialized = messages as IList<ChatMessage> ?? [.. messages];
        var enumerator = (_responses ?? chatCompletions).GetStreamingResponseAsync(materialized, options, cancellationToken).GetAsyncEnumerator(cancellationToken);
        try
        {
            bool hasFirst;
            try
            {
                hasFirst = await enumerator.MoveNextAsync();
            }
            catch (Exception ex) when (_responses is null && IsPointedAtResponses(ex))
            {
                await enumerator.DisposeAsync();
                enumerator = MoveToResponses().GetStreamingResponseAsync(materialized, options, cancellationToken).GetAsyncEnumerator(cancellationToken);
                hasFirst = await enumerator.MoveNextAsync();
            }

            while (hasFirst)
            {
                yield return enumerator.Current;
                hasFirst = await enumerator.MoveNextAsync();
            }
        }
        finally
        {
            await enumerator.DisposeAsync();
        }
    }

    /// <inheritdoc/>
    public object? GetService(Type serviceType, object? serviceKey = null) =>
        (_responses ?? chatCompletions).GetService(serviceType, serviceKey);

    /// <inheritdoc/>
    public void Dispose()
    {
        chatCompletions.Dispose();
        _responses?.Dispose();
    }

    IChatClient MoveToResponses()
    {
        lock (_lock)
        {
            return _responses ??= responses();
        }
    }
}
