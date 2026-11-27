// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// An <see cref="IChatClient"/> that omits the sampling temperature for models that do not accept it.
/// Requests to other models pass through unchanged.
/// </summary>
public sealed class TemperatureOmittingChatClient : DelegatingChatClient
{
    static readonly string[] _openAIReasoningFamilies = ["o1", "o3", "o4", "gpt-5"];

    readonly string _defaultModelId;
    readonly Func<string, bool> _requiresDefaultTemperature;

    /// <summary>
    /// Initializes a new instance of the <see cref="TemperatureOmittingChatClient"/> class
    /// that omits temperature for Claude models of generation 5 and later.
    /// </summary>
    /// <param name="innerClient">The client requests are passed on to.</param>
    /// <param name="defaultModelId">The model a request is for when its own options name none.</param>
    public TemperatureOmittingChatClient(IChatClient innerClient, string defaultModelId)
        : this(innerClient, defaultModelId, modelId => AnthropicProviderClient.UsesAdaptiveThinking(new ModelName(modelId)))
    {
    }

    TemperatureOmittingChatClient(IChatClient innerClient, string defaultModelId, Func<string, bool> requiresDefaultTemperature)
        : base(innerClient)
    {
        _defaultModelId = defaultModelId;
        _requiresDefaultTemperature = requiresDefaultTemperature;
    }

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

    /// <summary>
    /// Wraps an OpenAI client to omit temperature for reasoning model families.
    /// </summary>
    /// <param name="innerClient">The client requests are passed on to.</param>
    /// <param name="defaultModelId">The model a request is for when its own options name none.</param>
    /// <returns>The client with the OpenAI temperature policy applied.</returns>
    internal static TemperatureOmittingChatClient ForOpenAI(IChatClient innerClient, string defaultModelId) =>
        new(innerClient, defaultModelId, UsesOpenAIReasoningFamily);

    static bool UsesOpenAIReasoningFamily(string modelId) =>
        _openAIReasoningFamilies.Any(family => IsInFamily(modelId, family));

    static bool IsInFamily(string modelId, string family) =>
        modelId.StartsWith(family, StringComparison.OrdinalIgnoreCase) &&
        (modelId.Length == family.Length || modelId[family.Length] is '-' or '.');

    ChatOptions? WithoutTemperature(ChatOptions? options)
    {
        if (options?.Temperature is null)
        {
            return options;
        }

        var model = string.IsNullOrWhiteSpace(options.ModelId) ? _defaultModelId : options.ModelId;
        if (!_requiresDefaultTemperature(model))
        {
            return options;
        }

        var copy = options.Clone();
        copy.Temperature = null;
        return copy;
    }
}
