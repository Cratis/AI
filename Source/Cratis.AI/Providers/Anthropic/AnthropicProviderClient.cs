// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// An <see cref="IAIProviderClient"/> for the Anthropic Messages API. Ported from Direct's
/// <c>AIProviders.Anthropic.AnthropicProviderClient</c> (plan Section 5.2 step 3).
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="logger">The logger.</param>
public class AnthropicProviderClient(IHttpClientFactory httpClientFactory, ILogger<AnthropicProviderClient> logger) : IAIProviderClient
{
    const string BaseUrl = "https://api.anthropic.com";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.Anthropic;

    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, ConfiguredAIProvider provider, ModelName model, Effort effort, CancellationToken cancellationToken = default)
    {
        using var httpClient = httpClientFactory.CreateClient();
        var payload = BuildPayload(model, prompt, effort).ToJsonString();

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1/messages")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        AddCredential(request, provider.ApiKey);
        request.Headers.Add("anthropic-version", "2023-06-01");

        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            logger.NetworkFailure(exception, Type);
            return LanguageModelResult.TransientFailure($"The language model API could not be reached: {exception.Message}");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // The HttpClient's own request timeout, not the caller's cancellation - a slow vendor is
            // exactly the kind of thing worth another attempt at, possibly against a less-loaded one.
            logger.RequestTimedOut(Type);
            return LanguageModelResult.TransientFailure("The language model API did not respond in time");
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                logger.UnexpectedStatusCode(Type, (int)response.StatusCode);
                return TransientProviderFailures.FromStatusCode(response);
            }

            return await ReadCompletion(response, model, cancellationToken);
        }
    }

    /// <summary>
    /// Builds the Messages API request body, translating <paramref name="effort"/> into Anthropic's
    /// extended-thinking shape: <see cref="Effort.Low"/> sends no <c>thinking</c> block at all
    /// (thinking disabled is the API default); every other tier enables it with an increasing
    /// <c>budget_tokens</c>, and <c>max_tokens</c> is raised alongside it since the API requires
    /// <c>max_tokens</c> to exceed the thinking budget.
    /// </summary>
    /// <param name="model">The model to run the completion on.</param>
    /// <param name="prompt">The prompt.</param>
    /// <param name="effort">The reasoning effort to translate.</param>
    /// <returns>The request body.</returns>
    internal static JsonObject BuildPayload(ModelName model, string prompt, Effort effort)
    {
        var (budgetTokens, maxTokens) = ThinkingBudgetFor(effort);
        var payload = new JsonObject
        {
            ["model"] = model.Value,
            ["max_tokens"] = maxTokens,
            ["messages"] = new JsonArray(new JsonObject { ["role"] = "user", ["content"] = prompt }),
        };

        if (budgetTokens is { } budget)
        {
            payload["thinking"] = new JsonObject { ["type"] = "enabled", ["budget_tokens"] = budget };
        }

        return payload;
    }

    /// <summary>
    /// Maps an <see cref="Effort"/> tier to an extended-thinking token budget and the accompanying
    /// <c>max_tokens</c> - <see langword="null"/> for <see cref="Effort.Low"/> means thinking stays
    /// disabled; the API requires <c>budget_tokens</c> to be at least 1024 and strictly less than
    /// <c>max_tokens</c>, hence <c>max_tokens</c> growing with the budget.
    /// </summary>
    /// <param name="effort">The reasoning effort tier.</param>
    /// <returns>The thinking token budget (or <see langword="null"/> to disable it) and the <c>max_tokens</c> to send alongside it.</returns>
    internal static (int? BudgetTokens, int MaxTokens) ThinkingBudgetFor(Effort effort) => effort switch
    {
        Effort.Low => (null, 4096),
        Effort.Medium => (4096, 8192),
        Effort.High => (8192, 16384),
        Effort.ExtraHigh => (16384, 24576),
        _ => (null, 4096),
    };

    /// <summary>
    /// Authenticates the request the way the configured credential's own kind requires - see
    /// <see cref="AnthropicCredential"/>.
    /// </summary>
    /// <param name="request">The request being built.</param>
    /// <param name="apiKey">The provider's configured credential.</param>
    static void AddCredential(HttpRequestMessage request, AIProviderApiKey apiKey)
    {
        foreach (var (name, value) in AnthropicCredential.HeadersFor(apiKey))
        {
            request.Headers.Add(name, value);
        }
    }

    static LanguageModelUsage? UsageFrom(JsonObject? body)
    {
        if (body?["usage"] is not JsonObject usage)
        {
            return null;
        }

        var input = usage["input_tokens"]?.GetValue<long>() ?? 0L;
        var output = usage["output_tokens"]?.GetValue<long>() ?? 0L;
        return new(new Usage.InputTokens(input), new Usage.OutputTokens(output));
    }

    /// <summary>
    /// Parses a successful Messages API response into a <see cref="LanguageModelResult"/>.
    /// </summary>
    /// <param name="response">The successful response.</param>
    /// <param name="model">The model the completion ran on.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    async Task<LanguageModelResult> ReadCompletion(HttpResponseMessage response, ModelName model, CancellationToken cancellationToken)
    {
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
        var text = (body?["content"] as JsonArray)?
            .OfType<JsonObject>()
            .Where(block => block["type"]?.GetValue<string>() == "text")
            .Select(block => block["text"]?.GetValue<string>() ?? string.Empty)
            .FirstOrDefault();

        if (string.IsNullOrEmpty(text))
        {
            logger.NoTextReturned(Type);
            return LanguageModelResult.Failure("The language model returned no text");
        }

        return LanguageModelResult.Success(text, UsageFrom(body), model);
    }
}
