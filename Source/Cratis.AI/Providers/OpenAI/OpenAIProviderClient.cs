// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.OpenAI;

/// <summary>
/// An <see cref="IAIProviderClient"/> for OpenAI's public chat-completions API. Ported from
/// Direct's <c>AIProviders.OpenAI.OpenAIProviderClient</c> (plan Section 5.2 step 3).
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="logger">The logger.</param>
public class OpenAIProviderClient(IHttpClientFactory httpClientFactory, ILogger<OpenAIProviderClient> logger) : IAIProviderClient
{
    const string ChatCompletionsUrl = "https://api.openai.com/v1/chat/completions";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAI;

    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, ConfiguredAIProvider provider, ModelName model, Effort effort, CancellationToken cancellationToken = default)
    {
        // A ChatGPT subscription authenticates against the ChatGPT backend a Codex-style harness
        // provider talks to, not against api.openai.com - which answers 401 to it. That is the same
        // shape of failure a `claude setup-token` token pasted into an Anthropic API key field
        // produces, and the same lesson: name the configuration that is wrong rather than letting
        // the vendor's unexplained 401 be the only trace. The credential is perfectly good; it just
        // cannot be spent here, so this says where it can be.
        if (OpenAICredential.IsSubscriptionCredential(provider.ApiKey))
        {
            logger.SubscriptionCredentialCannotServeChat(Type);
            return LanguageModelResult.Failure(
                "This OpenAI provider is configured with a ChatGPT subscription, which only a worker session's harness can use. Chat completions need an OpenAI API key - configure one, or point this agent at a provider that has one.");
        }

        using var httpClient = httpClientFactory.CreateClient();
        return await OpenAIChatCompletionsProtocol.Complete(
            httpClient,
            new Uri(ChatCompletionsUrl),
            model,
            prompt,
            effort,
            headers => headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.ApiKey.Value),
            Type,
            logger,
            cancellationToken);
    }
}
