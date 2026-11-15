// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;

namespace Cratis.AI.ReverseProxy.Transport;

/// <summary>
/// Reaches the backend straight over HTTP - the transport to use when the proxy runs on the same machine, or the same
/// network, as the model. A tunnelling transport uses it on the far end.
/// </summary>
public sealed class DirectModelTransport : IModelTransport, IDisposable
{
    readonly HttpClient _client;
    readonly SocketsHttpHandler? _handler;

    /// <summary>
    /// Initializes a new instance of the <see cref="DirectModelTransport"/> class with its own client: no overall timeout, because
    /// a local model can think for minutes, and no redirects, because a backend that redirects is not one this proxy should
    /// follow off the machine.
    /// </summary>
    public DirectModelTransport()
    {
        _handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = System.Net.DecompressionMethods.None,
            ConnectTimeout = TimeSpan.FromSeconds(10),
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
        };
        _client = new HttpClient(_handler, disposeHandler: false) { Timeout = Timeout.InfiniteTimeSpan };
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="DirectModelTransport"/> class with a client the caller owns.
    /// </summary>
    /// <param name="client">The client requests are sent with. It must not time out a long generation.</param>
    public DirectModelTransport(HttpClient client) => _client = client;

    /// <inheritdoc/>
    public void Dispose()
    {
        if (_handler is not null)
        {
            _client.Dispose();
            _handler.Dispose();
        }
    }

    /// <inheritdoc/>
    public Task<HttpResponseMessage> Send(ModelEndpoint endpoint, HttpRequestMessage request, CancellationToken cancellationToken)
    {
        // The request URI the proxy built names the proxy's own placeholder host; only its path and query are the backend's.
        request.RequestUri = new Uri($"{ModelEndpoint.NormalizeBaseAddress(endpoint.BaseUrl)}{request.RequestUri!.PathAndQuery}", UriKind.Absolute);
        request.Headers.Host = null;
        ModelRequests.Authenticate(request, endpoint);
        return _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }
}
