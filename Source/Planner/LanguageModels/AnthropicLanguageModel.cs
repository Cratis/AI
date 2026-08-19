// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace Planner.LanguageModels;

/// <summary>
/// An <see cref="ILanguageModel"/> on top of the Anthropic Messages API - the default provider,
/// since every deployment already has an Anthropic relationship for the worker accounts.
/// </summary>
/// <param name="httpClient">The <see cref="HttpClient"/> to use - configured with the base address at registration.</param>
/// <param name="options">The language model configuration.</param>
public class AnthropicLanguageModel(HttpClient httpClient, IOptions<LanguageModelOptions> options) : ILanguageModel
{
    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, CancellationToken cancellationToken = default)
    {
        var configured = options.Value;
        if (!configured.IsConfigured)
        {
            return LanguageModelResult.Failure("No language model is configured (Planner:LanguageModel:ApiKey is empty)");
        }

        var payload = JsonSerializer.Serialize(new
        {
            model = configured.Model,
            max_tokens = 4096,
            messages = new[] { new { role = "user", content = prompt } }
        });

        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/messages")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-api-key", configured.ApiKey);
        request.Headers.Add("anthropic-version", "2023-06-01");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return LanguageModelResult.Failure($"The language model API returned {(int)response.StatusCode}");
        }

        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
        var text = (body?["content"] as JsonArray)?
            .OfType<JsonObject>()
            .Where(block => block["type"]?.GetValue<string>() == "text")
            .Select(block => block["text"]?.GetValue<string>() ?? string.Empty)
            .FirstOrDefault();

        return string.IsNullOrEmpty(text)
            ? LanguageModelResult.Failure("The language model returned no text")
            : LanguageModelResult.Success(text);
    }
}
