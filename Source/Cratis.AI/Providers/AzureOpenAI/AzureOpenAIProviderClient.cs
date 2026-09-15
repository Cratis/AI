// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.AzureOpenAI;

/// <summary>
/// An <see cref="IAIProviderClient"/> for an Azure OpenAI deployment - the <c>model</c> parameter on
/// <see cref="Complete"/> is the Azure deployment name, since Azure OpenAI addresses a model by the
/// name it was deployed under rather than a shared model identifier. Ported from Direct's
/// <c>AIProviders.AzureOpenAI.AzureOpenAIProviderClient</c> (plan Section 5.2 step 3).
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="quotaTracker">Records what the response's rate-limit headers reported about the provider's remaining quota (Cratis/AI#337).</param>
/// <param name="logger">The logger.</param>
public class AzureOpenAIProviderClient(IHttpClientFactory httpClientFactory, IAIProviderQuotaTracker quotaTracker, ILogger<AzureOpenAIProviderClient> logger) : IAIProviderClient
{
    const string ApiVersion = "2024-06-01";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.AzureOpenAI;

    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, ConfiguredAIProvider provider, ModelName model, Effort effort, CancellationToken cancellationToken = default)
    {
        var endpoint = provider.Endpoint?.Value.TrimEnd('/') ?? string.Empty;
        var requestUri = new Uri($"{endpoint}/openai/deployments/{Uri.EscapeDataString(model.Value)}/chat/completions?api-version={ApiVersion}");

        using var httpClient = httpClientFactory.CreateClient();
        return await OpenAIChatCompletionsProtocol.Complete(
            httpClient,
            requestUri,
            model,
            prompt,
            effort,
            headers => headers.Add("api-key", provider.ApiKey.Value),
            Type,
            provider.Id,
            quotaTracker,
            logger,
            cancellationToken);
    }
}
