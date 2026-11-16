// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.Discovery;

/// <summary>
/// Finds out what a backend serves by asking it: the OpenAI-shaped model list that Ollama, LM Studio, vLLM, llama.cpp and the
/// like all answer, Anthropic's own list, and Ollama's native <c>/api/tags</c> as a last resort.
/// </summary>
/// <param name="client">The <see cref="HttpClient"/> to probe with. Give it a short timeout.</param>
public class ModelDiscovery(HttpClient client)
{
    /// <summary>
    /// Probes a backend.
    /// </summary>
    /// <param name="baseUrl">The backend's address.</param>
    /// <param name="apiKey">The credential it wants, if any.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/>.</param>
    /// <returns>What was found.</returns>
    public async Task<DiscoveryResult> Probe(string baseUrl, string apiKey, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(ModelEndpoint.NormalizeBaseAddress(baseUrl), UriKind.Absolute, out var root) || root.Scheme is not ("http" or "https"))
        {
            return DiscoveryResult.Unreachable($"'{baseUrl}' is not an http or https address");
        }

        var listing = await Get(new Uri(root, $"{root.AbsolutePath.TrimEnd('/')}/v1/models"), apiKey, withAnthropicHeaders: false, cancellationToken);
        if (listing.Status == HttpStatusCode.OK && listing.Body is { } body)
        {
            var parsed = ParseListing(body);
            if (parsed is not null)
            {
                return parsed;
            }
        }

        if (listing.Status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            return DiscoveryResult.Unreachable("It answered, but refused the credential - set the API key it expects");
        }

        var native = await Get(new Uri(root, $"{root.AbsolutePath.TrimEnd('/')}/api/tags"), apiKey, withAnthropicHeaders: false, cancellationToken);
        if (native.Status == HttpStatusCode.OK && native.Body is { } tags && ParseOllamaTags(tags) is { } ollama)
        {
            return ollama;
        }

        return DiscoveryResult.Unreachable(listing.Status is null
            ? $"Nothing answered at {root}: {listing.Failure}"
            : $"It answered {(int)listing.Status.Value}, which is not a model list - check the address and port");
    }

    /// <summary>
    /// Reads an OpenAI- or Anthropic-shaped model list.
    /// </summary>
    /// <param name="body">The response body.</param>
    /// <returns>The result, or null when it is not a model list.</returns>
    internal static DiscoveryResult? ParseListing(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            // Anthropic's list carries has_more; OpenAI's carries object: "list". Every local server answers the latter.
            var anthropic = root.TryGetProperty("has_more", out _) && !root.TryGetProperty("object", out _);
            var models = data.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.Object && item.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String)
                .Select(item => new ServedModel(
                    item.GetProperty("id").GetString()!,
                    item.TryGetProperty("display_name", out var display) && display.ValueKind == JsonValueKind.String ? display.GetString()! : string.Empty,
                    ContextWindowOf(item)))
                .ToArray();
            return new(true, anthropic ? AIProtocol.Anthropic : AIProtocol.OpenAI, models);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Reads Ollama's native tag list.
    /// </summary>
    /// <param name="body">The response body.</param>
    /// <returns>The result, or null when it is not a tag list.</returns>
    internal static DiscoveryResult? ParseOllamaTags(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.ValueKind != JsonValueKind.Object || !document.RootElement.TryGetProperty("models", out var list) || list.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var models = list.EnumerateArray()
                .Select(item => item.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String ? name.GetString() : null)
                .OfType<string>()
                .Select(name => new ServedModel(name))
                .ToArray();

            // Ollama answers OpenAI-shaped requests on the same address even when its model list is only reachable natively.
            return new(true, AIProtocol.OpenAI, models);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Reads the context window a server reports under whichever name it uses.
    /// </summary>
    /// <param name="item">One model entry.</param>
    /// <returns>The tokens; zero when none is reported.</returns>
    static int ContextWindowOf(JsonElement item)
    {
        foreach (var name in new[] { "context_length", "max_context_length", "context_window", "max_model_len" })
        {
            if (item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var tokens))
            {
                return tokens;
            }
        }

        return 0;
    }

    async Task<(HttpStatusCode? Status, string? Body, string Failure)> Get(Uri uri, string apiKey, bool withAnthropicHeaders, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        if (!string.IsNullOrEmpty(apiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }

        if (withAnthropicHeaders)
        {
            request.Headers.TryAddWithoutValidation(AIProtocols.AnthropicVersionHeader, AIProtocols.DefaultAnthropicVersion);
        }

        try
        {
            using var response = await client.SendAsync(request, cancellationToken);
            return (response.StatusCode, await response.Content.ReadAsStringAsync(cancellationToken), string.Empty);
        }
        catch (HttpRequestException exception)
        {
            return (null, null, exception.InnerException?.Message ?? exception.Message);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return (null, null, "it did not answer in time");
        }
    }
}
