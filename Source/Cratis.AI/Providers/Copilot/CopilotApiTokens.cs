// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using System.Text.Json.Nodes;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Copilot;

/// <summary>
/// Exchanges a GitHub credential for the short-lived token Copilot's own API is addressed with.
/// </summary>
/// <remarks>
/// A GitHub token is not itself a Copilot API credential: the Copilot endpoints take a separate,
/// short-lived token minted from it, which is why this step exists at all rather than the caller
/// sending the stored credential straight to <c>api.githubcopilot.com</c>. Every Copilot client -
/// the CLI included - performs the same exchange at startup. The endpoint is not part of GitHub's
/// published REST API, so every caller here treats a refusal as "the catalog is unavailable right
/// now" rather than as a defect, and nothing in dispatch depends on it: a worker session hands the
/// CLI the GitHub credential and lets the CLI do its own exchange.
/// </remarks>
public interface ICopilotApiTokens
{
    /// <summary>
    /// Exchanges a stored credential for a Copilot API token.
    /// </summary>
    /// <param name="apiKey">The stored GitHub credential, already revealed.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The token, or <see langword="null"/> when GitHub would not issue one.</returns>
    Task<string?> Exchange(AIProviderApiKey apiKey, CancellationToken cancellationToken = default);
}

/// <summary>
/// The default <see cref="ICopilotApiTokens"/>.
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> the exchange is made with.</param>
/// <param name="logger">The logger.</param>
[Singleton]
public class CopilotApiTokens(IHttpClientFactory httpClientFactory, ILogger<CopilotApiTokens> logger) : ICopilotApiTokens
{
    const string ExchangeUrl = "https://api.github.com/copilot_internal/v2/token";

    /// <inheritdoc/>
    public async Task<string?> Exchange(AIProviderApiKey apiKey, CancellationToken cancellationToken = default)
    {
        var credential = CopilotCredential.AccessTokenFor(apiKey);
        if (string.IsNullOrWhiteSpace(credential))
        {
            return null;
        }

        try
        {
            using var httpClient = httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(10);

            using var request = new HttpRequestMessage(HttpMethod.Get, ExchangeUrl);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {credential}");
            request.Headers.TryAddWithoutValidation("Accept", "application/json");

            // GitHub's API refuses a request with no user agent outright, which reads as an
            // authentication failure if it is not set.
            request.Headers.TryAddWithoutValidation("User-Agent", "Cratis-Direct");

            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.ExchangeRejected((int)response.StatusCode);
                return null;
            }

            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
            var token = body?["token"]?.GetValue<string>();
            return string.IsNullOrWhiteSpace(token) ? null : token;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
        {
            logger.ExchangeFailed(exception);
            return null;
        }
    }
}

/// <summary>
/// Log messages for the Copilot token exchange.
/// </summary>
internal static partial class CopilotApiTokensLog
{
    [LoggerMessage(LogLevel.Information, "GitHub would not issue a Copilot API token - HTTP {StatusCode}")]
    internal static partial void ExchangeRejected(this ILogger logger, int statusCode);

    [LoggerMessage(LogLevel.Information, "A Copilot API token could not be obtained")]
    internal static partial void ExchangeFailed(this ILogger logger, Exception exception);
}
