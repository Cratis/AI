// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.OpenAICompatible;

/// <summary>
/// An <see cref="IAIProviderClient"/> for a self-hosted or third-party endpoint that speaks OpenAI's
/// chat-completions API shape (Ollama, LocalAI, and similar). Ported from Direct's
/// <c>AIProviders.OpenAICompatible.OpenAICompatibleProviderClient</c> (plan Section 5.2 step 3) - the
/// first concrete vendor client in the package, proving <see cref="IAIProviderClient"/> end to end.
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="logger">The logger.</param>
public class OpenAICompatibleProviderClient(IHttpClientFactory httpClientFactory, ILogger<OpenAICompatibleProviderClient> logger) : IAIProviderClient
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAICompatible;

    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, ConfiguredAIProvider provider, ModelName model, Effort effort, CancellationToken cancellationToken = default)
    {
        var endpoint = provider.Endpoint?.Value.TrimEnd('/') ?? string.Empty;
        var requestUri = new Uri($"{endpoint}/v1/chat/completions");
        var apiKey = provider.ApiKey.Value;

        using var httpClient = httpClientFactory.CreateClient();
        return await OpenAIChatCompletionsProtocol.Complete(
            httpClient,
            requestUri,
            model,
            prompt,
            effort,
            headers =>
            {
                // Many local gateways accept requests unauthenticated - only set the header when
                // there is a key, rather than sending an empty Bearer token.
                if (!string.IsNullOrEmpty(apiKey))
                {
                    headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                }
            },
            Type,
            logger,
            cancellationToken);
    }
}
