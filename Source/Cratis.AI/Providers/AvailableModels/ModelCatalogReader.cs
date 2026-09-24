// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Common;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Defines the single HTTP reader every vendor's model listing goes through.
/// </summary>
public interface IModelCatalogReader
{
    /// <summary>
    /// Reads a model catalog from a vendor endpoint.
    /// </summary>
    /// <param name="url">The catalog URL to read.</param>
    /// <param name="headers">The authentication headers the vendor expects.</param>
    /// <returns>The model names the catalog lists - empty when the endpoint cannot be read.</returns>
    Task<IEnumerable<ModelName>> Read(string url, IEnumerable<KeyValuePair<string, string>> headers);
}

/// <summary>
/// Represents an implementation of <see cref="IModelCatalogReader"/>. Every vendor Direct talks to
/// publishes its catalog in the same <c>{ "data": [ { "id": ... } ] }</c> shape OpenAI established -
/// Anthropic and Azure deployment listings included - so one reader serves all of them, the same
/// observation Studio's <c>ModelCatalogReader</c> is built on. A failure of any kind - a non-success
/// status, a timeout, an unparseable body - is logged and thrown as <see cref="ModelCatalogUnavailable"/>,
/// so discovery records it as its own outcome and the catalog pass keeps retrying, rather than a
/// dead credential being stamped as "publishes no models" and believed for the staleness window.
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="logger">The logger.</param>
[Singleton]
public class ModelCatalogReader(IHttpClientFactory httpClientFactory, ILogger<ModelCatalogReader> logger) : IModelCatalogReader
{
    static readonly TimeSpan _timeout = TimeSpan.FromSeconds(5);

    /// <inheritdoc/>
    public async Task<IEnumerable<ModelName>> Read(string url, IEnumerable<KeyValuePair<string, string>> headers)
    {
        try
        {
            using var httpClient = httpClientFactory.CreateClient();
            httpClient.Timeout = _timeout;

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            foreach (var header in headers)
            {
                request.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }

            using var response = await httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                logger.CatalogAnsweredWithStatus(url, (int)response.StatusCode);
                throw new ModelCatalogUnavailable(url, (int)response.StatusCode);
            }

            var catalog = JsonSerializer.Deserialize<Catalog>(
                await response.Content.ReadAsStringAsync(),
                JsonSerializerOptions.Web);
            return [.. (catalog?.Data ?? [])
                .Where(entry => !string.IsNullOrWhiteSpace(entry.Id))
                .Select(entry => new ModelName(entry.Id))];
        }
        catch (Exception exception) when (exception
            is HttpRequestException
            or OperationCanceledException
            or JsonException
            or NotSupportedException
            or InvalidOperationException
            or UriFormatException)
        {
            logger.CouldNotReadCatalog(exception, url);
            throw new ModelCatalogUnavailable(url, exception);
        }
    }

    sealed record Catalog(IEnumerable<CatalogEntry>? Data);

    sealed record CatalogEntry(string Id);
}
