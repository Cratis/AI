// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.ClientModel;
using Anthropic;
using Anthropic.Core;
using Cratis.AI.Common;
using Cratis.AI.Providers;
using Microsoft.Extensions.AI;
using OpenAI;

namespace Cratis.AI.Conversations;

/// <summary>
/// Builds a <see cref="Microsoft.Extensions.AI.IChatClient"/> for a configured AI provider - the
/// vendor-generic half of what Studio's own <c>Agent.ChatClient.CreateChatClientFor</c> used to do
/// entirely locally, ported here so it is shared rather than reimplemented (ai-consolidation-plan.md
/// Section 5.4). Every method takes primitive values rather than a whole
/// <c>ConfiguredAIProvider</c> read model, since Direct's and Studio's own shapes differ (decision
/// 0009) and this needs to work against either.
/// </summary>
/// <remarks>
/// Deliberately separate from <see cref="Providers.IAIProviderClient"/>/<see cref="LanguageModels.ILanguageModel"/> -
/// those are a completion-in/completion-out surface built for worker-dispatched agent sessions, with
/// pool failover, quota tracking and concurrency gating layered on top over raw HTTP. An
/// <see cref="Microsoft.Extensions.AI.IChatClient"/> is a different shape entirely: an in-process,
/// multi-turn conversational client a caller drives turn by turn, built on each vendor's own SDK
/// (which already has its own retry/transport behavior). Reconciling the two into one resolution
/// path - so a conversational caller also benefits from pool/tier/concurrency resolution - is real,
/// separate work the plan calls "the core technical work" of the Conversational API step; this class
/// is the first, load-bearing piece of it, not that reconciliation itself.
/// </remarks>
public static class AIChatClientFactory
{
    /// <summary>
    /// The model identifier used when an OpenAI provider names none.
    /// </summary>
    public const string DefaultOpenAIModelId = "gpt-4o-mini";

    /// <summary>
    /// The model identifier used when an Anthropic provider names none.
    /// </summary>
    public const string DefaultAnthropicModelId = "claude-opus-4-6";

    const string NoCredentialPlaceholder = "no-key";

    /// <summary>
    /// Resolves which model identifier to talk to: an explicit override first, then whatever the
    /// provider itself was configured with, and finally the vendor's own sane default.
    /// </summary>
    /// <param name="type">The vendor the provider talks to.</param>
    /// <param name="configuredModel">The model identifier the provider itself was configured with, if any.</param>
    /// <param name="modelOverride">A caller's own chosen model identifier, if it has one - wins over the configured value.</param>
    /// <returns>The model identifier, or an empty string when nothing names one and the vendor has no default.</returns>
    /// <remarks>
    /// A configured provider does not have to name a model - Azure OpenAI and an OpenAI-compatible
    /// gateway address a deployment or a locally pulled model only the operator can name, so those
    /// genuinely have no sane default and stay unusable until a caller supplies one. OpenAI and
    /// Anthropic both have a reasonable current default, so a provider configured with credentials
    /// alone still serves.
    /// </remarks>
    public static string ResolveModelId(AIProviderType type, ModelName? configuredModel, ModelName? modelOverride = null)
    {
        if (HasValue(modelOverride))
        {
            return modelOverride!.Value;
        }

        if (HasValue(configuredModel))
        {
            return configuredModel!.Value;
        }

        return type switch
        {
            AIProviderType.OpenAI => DefaultOpenAIModelId,
            AIProviderType.Anthropic => DefaultAnthropicModelId,
            _ => string.Empty
        };
    }

    /// <summary>
    /// Determines whether a provider carries everything its vendor needs to actually open a chat client.
    /// </summary>
    /// <param name="type">The vendor the provider talks to.</param>
    /// <param name="apiKey">The provider's API key, when it has one.</param>
    /// <param name="endpoint">The provider's endpoint, when it has one.</param>
    /// <param name="configuredModel">The model identifier the provider itself was configured with, if any.</param>
    /// <param name="modelOverride">A caller's own chosen model identifier, if it has one.</param>
    /// <returns><see langword="true"/> when <see cref="Create"/> can build a working client.</returns>
    public static bool CanServe(
        AIProviderType type,
        AIProviderApiKey? apiKey,
        AIProviderEndpoint? endpoint,
        ModelName? configuredModel,
        ModelName? modelOverride = null)
    {
        var modelId = ResolveModelId(type, configuredModel, modelOverride);

        return type switch
        {
            AIProviderType.OpenAI => HasValue(apiKey) && !string.IsNullOrWhiteSpace(modelId),
            AIProviderType.AzureOpenAI => HasValue(apiKey) && HasValue(endpoint) && !string.IsNullOrWhiteSpace(modelId),
            AIProviderType.Anthropic => HasValue(apiKey) && !string.IsNullOrWhiteSpace(modelId),
            AIProviderType.OpenAICompatible => HasValue(endpoint) && !string.IsNullOrWhiteSpace(modelId),
            _ => false
        };
    }

    /// <summary>
    /// Builds the chat client for a configured provider, or <see langword="null"/> when the vendor
    /// is not one this factory knows how to reach.
    /// </summary>
    /// <param name="type">The vendor the provider talks to.</param>
    /// <param name="apiKey">The provider's API key, when it has one.</param>
    /// <param name="endpoint">The provider's endpoint, when it has one.</param>
    /// <param name="modelId">The model identifier to open the client against - from <see cref="ResolveModelId"/>.</param>
    /// <returns>
    /// The client and the model identifier it was opened with, or <see langword="null"/> for a vendor
    /// this factory does not build a conversational client for (<see cref="AIProviderType.ZAI"/> and
    /// <see cref="AIProviderType.OpenAICodex"/> are agent-harness-only providers, not conversational
    /// ones - see their own remarks).
    /// </returns>
    /// <remarks>
    /// Callers are expected to have already checked <see cref="CanServe"/> - this does not repeat that
    /// check, and dereferences <paramref name="apiKey"/>/<paramref name="endpoint"/> for the vendors
    /// that need them.
    /// </remarks>
    public static (IChatClient Client, string ModelId)? Create(AIProviderType type, AIProviderApiKey? apiKey, AIProviderEndpoint? endpoint, string modelId) =>
        type switch
        {
            AIProviderType.OpenAI =>
                (new OpenAI.Chat.ChatClient(modelId, apiKey!.Value).AsIChatClient(), modelId),

            AIProviderType.AzureOpenAI =>
                (new OpenAI.Chat.ChatClient(
                    modelId,
                    new ApiKeyCredential(apiKey!.Value),
                    new OpenAIClientOptions
                    {
                        Endpoint = NormalizeAzureOpenAIEndpoint(endpoint!.Value),
                    }).AsIChatClient(),
                    modelId),

            // AnthropicClient's own disposal is handed to the IChatClient wrapper AsIChatClient()
            // returns - the caller disposes the returned client, not this one, exactly as Studio's
            // own original code already assumed. CA2000 cannot trace ownership through the wrapping
            // extension method, so it reads this as a leak; it is not one.
#pragma warning disable CA2000
            AIProviderType.Anthropic =>
                (new AnthropicClient(new ClientOptions
                {
                    ApiKey = apiKey!.Value,
                }).AsIChatClient(),
                    modelId),
#pragma warning restore CA2000

            AIProviderType.OpenAICompatible =>
                (new OpenAI.Chat.ChatClient(
                    modelId,
                    new ApiKeyCredential(HasValue(apiKey) ? apiKey!.Value : NoCredentialPlaceholder),
                    new OpenAIClientOptions
                    {
                        Endpoint = NormalizeOpenAICompatibleEndpoint(endpoint!.Value),
                    }).AsIChatClient(),
                    modelId),

            _ => null,
        };

    static bool HasValue(Cratis.Concepts.ConceptAs<string>? value) => !string.IsNullOrWhiteSpace(value?.Value);

    /// <summary>
    /// Normalizes an Azure OpenAI resource endpoint to the versioned base URL the OpenAI SDK's
    /// Azure-compatible client needs.
    /// </summary>
    /// <param name="endpoint">The endpoint as configured.</param>
    /// <returns>The normalized endpoint.</returns>
    public static Uri NormalizeAzureOpenAIEndpoint(string endpoint) =>
        new($"{endpoint.TrimEnd('/')}/openai/v1/");

    /// <summary>
    /// Normalizes an OpenAI-compatible gateway endpoint - appending the OpenAI-shaped API version
    /// segment (<c>/v1</c>) unless the configured endpoint already names one, so both a bare host and
    /// one a caller already versioned work the same way.
    /// </summary>
    /// <param name="endpoint">The endpoint as configured.</param>
    /// <returns>The normalized endpoint.</returns>
    public static Uri NormalizeOpenAICompatibleEndpoint(string endpoint) =>
        new($"{NormalizeOpenAICompatibleBase(endpoint)}/");

    /// <summary>
    /// The base-URL half of <see cref="NormalizeOpenAICompatibleEndpoint"/>, exposed separately for
    /// callers (Studio's own settings validation) that need the normalized base without the trailing
    /// slash a full endpoint URI carries.
    /// </summary>
    /// <param name="endpoint">The endpoint as configured.</param>
    /// <returns>The normalized base, with no trailing slash.</returns>
    public static string NormalizeOpenAICompatibleBase(string endpoint)
    {
        var normalized = endpoint.TrimEnd('/');
        var lastSegment = normalized[(normalized.LastIndexOf('/') + 1)..];
        var alreadyNamesVersion = lastSegment.Length > 1 &&
            lastSegment[0] is 'v' or 'V' &&
            lastSegment[1..].All(char.IsDigit);

        return alreadyNamesVersion ? normalized : $"{normalized}/v1";
    }
}
