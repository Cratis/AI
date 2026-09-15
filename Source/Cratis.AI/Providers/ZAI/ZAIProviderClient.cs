// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Anthropic;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.ZAI;

/// <summary>
/// An <see cref="IAIProviderClient"/> for Z.ai's Anthropic-compatible Messages API. Ported from
/// Direct's <c>AIProviders.ZAI.ZAIProviderClient</c> (plan Section 5.2 step 3) - the donor's own
/// remark explains why this exists as a chat-completion path at all: without it, a pool or agent
/// naming a Z.ai provider resolves dead for every completion that never leaves a harness container
/// (branch naming, triage, screening, chat).
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="logger">The logger.</param>
/// <remarks>
/// <see cref="DefaultEndpoint"/> is duplicated from Direct's <c>HarnessSupport.ProviderHarnessSupport</c>
/// rather than shared with it, because that module (plan Section 5.2 step 6 / Section 5.6) has not
/// been ported yet. When it is, this constant should be removed in favour of the shared one - the
/// two must never drift apart, since the harness container and this in-app client need to agree on
/// which Z.ai gateway a provider with no explicit endpoint configured actually means.
/// </remarks>
public class ZAIProviderClient(IHttpClientFactory httpClientFactory, ILogger<ZAIProviderClient> logger) : IAIProviderClient
{
    /// <summary>
    /// Z.ai's public Anthropic-compatible gateway - what a provider with no explicit endpoint means.
    /// </summary>
    internal const string DefaultEndpoint = "https://api.z.ai/api/anthropic";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.ZAI;

    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, ConfiguredAIProvider provider, ModelName model, Effort effort, CancellationToken cancellationToken = default)
    {
        var endpoint = (provider.Endpoint is { } configured && configured != AIProviderEndpoint.NotSet
            ? configured.Value
            : DefaultEndpoint).TrimEnd('/');

        using var httpClient = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{endpoint}/v1/messages")
        {
            // Z.ai's Anthropic-compatible surface is the Messages API the Anthropic client already
            // translates Effort for - one payload shape, one place it lives.
            Content = new StringContent(AnthropicProviderClient.BuildPayload(model, prompt, effort).ToJsonString(), Encoding.UTF8, "application/json"),
        };

        // Z.ai authenticates its gateway-style keys as a bearer token, the same credential contract
        // a Claude-style harness honors through ANTHROPIC_AUTH_TOKEN. An x-api-key header, the
        // Anthropic-native slot, is answered with a 401 that names neither.
        request.Headers.Add("authorization", $"Bearer {provider.ApiKey.Value}");
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
