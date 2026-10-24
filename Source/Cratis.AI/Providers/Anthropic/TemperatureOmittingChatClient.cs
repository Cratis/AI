// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// An <see cref="IChatClient"/> that leaves the sampling temperature out of a request to a Claude model that
/// has deprecated it - every model of generation 5 and later answers a request carrying one with
/// <c>invalid_request_error: temperature is deprecated for this model</c>. Other models see the request untouched.
/// </summary>
/// <param name="innerClient">The client requests are passed on to.</param>
/// <param name="defaultModelId">The model a request is for when its own options name none.</param>
public sealed class TemperatureOmittingChatClient(IChatClient innerClient, string defaultModelId) : DelegatingChatClient(innerClient)
{
    /// <inheritdoc/>
    public override Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default) =>
        base.GetResponseAsync(messages, WithoutTemperature(options), cancellationToken);

    /// <inheritdoc/>
    public override IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default) =>
        base.GetStreamingResponseAsync(messages, WithoutTemperature(options), cancellationToken);

    ChatOptions? WithoutTemperature(ChatOptions? options)
    {
        if (options?.Temperature is null)
        {
            return options;
        }

        var model = string.IsNullOrWhiteSpace(options.ModelId) ? defaultModelId : options.ModelId;
        if (!AnthropicProviderClient.UsesAdaptiveThinking(new ModelName(model)))
        {
            return options;
        }

        var copy = options.Clone();
        copy.Temperature = null;
        return copy;
    }
}
