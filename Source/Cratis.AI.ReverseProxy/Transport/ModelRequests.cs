// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.Transport;

/// <summary>
/// Builds the request a backend receives from the one the proxy was given, and makes sure the caller's credential never reaches
/// the backend: the backend is only ever authenticated as the endpoint's own configured key.
/// </summary>
public static class ModelRequests
{
    static readonly HashSet<string> _notForwarded = new(StringComparer.OrdinalIgnoreCase)
    {
        "authorization", "x-api-key", "host", "connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade",
        "proxy-authorization", "proxy-authenticate", "cookie", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto",
        "x-ms-client-principal", "x-ms-client-principal-id", "x-ms-client-principal-name", "forwarded"
    };

    /// <summary>
    /// Creates the request to send to the endpoint's backend.
    /// </summary>
    /// <param name="endpoint">The <see cref="ModelEndpoint"/>.</param>
    /// <param name="method">The HTTP method.</param>
    /// <param name="pathAndQuery">The path and query, starting with <c>/</c>.</param>
    /// <param name="headers">The caller's headers; the credential and hop-by-hop ones are dropped.</param>
    /// <param name="content">The body, or null.</param>
    /// <returns>The request, ready to send.</returns>
    public static HttpRequestMessage Create(ModelEndpoint endpoint, HttpMethod method, string pathAndQuery, IEnumerable<KeyValuePair<string, IEnumerable<string>>> headers, HttpContent? content)
    {
        var request = new HttpRequestMessage(method, new Uri($"{ModelEndpoint.NormalizeBaseAddress(endpoint.BaseUrl)}{pathAndQuery}", UriKind.Absolute)) { Content = content };
        foreach (var (name, values) in headers)
        {
            if (!_notForwarded.Contains(name))
            {
                request.Headers.TryAddWithoutValidation(name, values);
            }
        }

        Authenticate(request, endpoint);
        return request;
    }

    /// <summary>
    /// Removes what a backend must never receive from a request that was proxied: the caller's credential, the forwarded-identity
    /// headers and everything hop-by-hop.
    /// </summary>
    /// <param name="request">The request, changed in place.</param>
    public static void Sanitize(HttpRequestMessage request)
    {
        foreach (var name in request.Headers.Select(header => header.Key).Where(_notForwarded.Contains).ToArray())
        {
            request.Headers.Remove(name);
        }
    }

    /// <summary>
    /// Authenticates a request as the endpoint, in the form of the protocol the request is spoken in.
    /// </summary>
    /// <param name="request">The request.</param>
    /// <param name="endpoint">The <see cref="ModelEndpoint"/>.</param>
    public static void Authenticate(HttpRequestMessage request, ModelEndpoint endpoint)
    {
        request.Headers.Remove("Authorization");
        request.Headers.Remove("x-api-key");
        if (string.IsNullOrEmpty(endpoint.ApiKey))
        {
            return;
        }

        var path = request.RequestUri?.AbsolutePath ?? string.Empty;
        var anthropic = AIProtocols.Detect(path, request.Headers.Contains(AIProtocols.AnthropicVersionHeader)) == AIProtocol.Anthropic;
        if (anthropic)
        {
            request.Headers.TryAddWithoutValidation("x-api-key", endpoint.ApiKey);
        }
        else
        {
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {endpoint.ApiKey}");
        }
    }
}
