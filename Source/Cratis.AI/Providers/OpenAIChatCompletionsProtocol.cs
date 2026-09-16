// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers;

/// <summary>
/// The request/response shape OpenAI's chat-completions API defines and every OpenAI-compatible
/// vendor (OpenAI itself, Azure OpenAI, self-hosted gateways) follows - shared by every
/// <see cref="IAIProviderClient"/> built on that shape, which differ only in the URL they send it
/// to and how they authenticate. Ported from Direct's <c>AIProviders.OpenAIChatCompletionsProtocol</c>
/// (plan Section 5.2 step 3).
/// </summary>
public static class OpenAIChatCompletionsProtocol
{
    /// <summary>
    /// Sends a chat-completions request and interprets the response as a <see cref="LanguageModelResult"/>.
    /// </summary>
    /// <param name="httpClient">The <see cref="HttpClient"/> to send the request with.</param>
    /// <param name="requestUri">The absolute chat-completions endpoint to send the request to.</param>
    /// <param name="model">The model to run the completion on.</param>
    /// <param name="prompt">The prompt.</param>
    /// <param name="effort">The reasoning effort to run the completion at - translated to <c>reasoning_effort</c>.</param>
    /// <param name="configureHeaders">Sets the vendor's own authentication header(s) on the request.</param>
    /// <param name="vendor">The vendor the request is sent to - for the log entry when the call fails, and to select how <paramref name="quotaTracker"/> reads the response's rate-limit headers.</param>
    /// <param name="providerId">The configured provider the request was sent as - what <paramref name="quotaTracker"/> keys its reading by.</param>
    /// <param name="quotaTracker">Records what the response's rate-limit headers, if any, reported about the provider's remaining quota (Cratis/AI#337).</param>
    /// <param name="logger">The logger a failed or empty response is recorded on.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    public static async Task<LanguageModelResult> Complete(
        HttpClient httpClient,
        Uri requestUri,
        string model,
        string prompt,
        Effort effort,
        Action<HttpRequestHeaders> configureHeaders,
        AIProviderType vendor,
        AIProviderId providerId,
        IAIProviderQuotaTracker quotaTracker,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        var payload = BuildPayload(model, prompt, effort).ToJsonString();

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        configureHeaders(request.Headers);

        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            logger.NetworkFailure(exception, vendor);
            return LanguageModelResult.TransientFailure($"The language model API could not be reached: {exception.Message}");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // The HttpClient's own request timeout, not the caller's cancellation - a slow vendor is
            // exactly the kind of thing worth another attempt at, possibly against a less-loaded one.
            logger.RequestTimedOut(vendor);
            return LanguageModelResult.TransientFailure("The language model API did not respond in time");
        }

        using (response)
        {
            quotaTracker.Report(providerId, vendor, response);

            if (!response.IsSuccessStatusCode)
            {
                logger.UnexpectedStatusCode(vendor, (int)response.StatusCode);
                return TransientProviderFailures.FromStatusCode(response);
            }

            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
            var text = (body?["choices"] as JsonArray)?
                .OfType<JsonObject>()
                .Select(choice => (choice["message"] as JsonObject)?["content"]?.GetValue<string>())
                .FirstOrDefault(value => !string.IsNullOrEmpty(value));

            if (string.IsNullOrEmpty(text))
            {
                logger.NoTextReturned(vendor);
                return LanguageModelResult.Failure("The language model returned no text");
            }

            return LanguageModelResult.Success(text, UsageFrom(body), model);
        }
    }

    /// <summary>
    /// Builds the chat-completions request body, translating <paramref name="effort"/> to OpenAI's
    /// <c>reasoning_effort</c> field. Sent unconditionally rather than gated on the model name - the
    /// vendors sharing this protocol document it as ignored by models that do not support reasoning,
    /// and gating on model name here would need per-vendor model-name knowledge this shared helper
    /// deliberately does not have.
    /// </summary>
    /// <param name="model">The model to run the completion on.</param>
    /// <param name="prompt">The prompt.</param>
    /// <param name="effort">The reasoning effort to translate.</param>
    /// <returns>The request body.</returns>
    internal static JsonObject BuildPayload(string model, string prompt, Effort effort) => new()
    {
        ["model"] = model,
        ["reasoning_effort"] = ReasoningEffortFor(effort),
        ["messages"] = new JsonArray(new JsonObject { ["role"] = "user", ["content"] = prompt }),
    };

    /// <summary>
    /// Maps an <see cref="Effort"/> tier to the <c>reasoning_effort</c> value OpenAI's chat-completions
    /// API documents, from <c>"low"</c> up to <c>"max"</c> for <see cref="Effort.ExtraHigh"/>.
    /// </summary>
    /// <param name="effort">The reasoning effort tier.</param>
    /// <returns>The <c>reasoning_effort</c> value.</returns>
    internal static string ReasoningEffortFor(Effort effort) => effort switch
    {
        Effort.Low => "low",
        Effort.Medium => "medium",
        Effort.High => "high",
        Effort.ExtraHigh => "max",
        _ => "medium",
    };

    static LanguageModelUsage? UsageFrom(JsonObject? body)
    {
        if (body?["usage"] is not JsonObject usage)
        {
            return null;
        }

        var input = usage["prompt_tokens"]?.GetValue<long>() ?? 0L;
        var output = usage["completion_tokens"]?.GetValue<long>() ?? 0L;
        return new(new Usage.InputTokens(input), new Usage.OutputTokens(output));
    }
}
